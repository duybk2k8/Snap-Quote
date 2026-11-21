import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { StepProgress } from "@/components/snapquote/StepProgress";
import { UploadStep, type MaskPainter } from "@/components/snapquote/UploadStep";
import { CUSTOM, DetectionStep } from "@/components/snapquote/DetectionStep";
import { PreviewStep } from "@/components/snapquote/PreviewStep";
import { ContractStep } from "@/components/snapquote/ContractStep";
import { api, type Detection, type Estimate, type ReplacementOption } from "@/lib/snapquote-api";

export const Route = createFileRoute("/quote")({
  head: () => ({
    meta: [
      { title: "Get a quote · SnapQuote" },
      { name: "description", content: "Upload a photo, preview the replacement and get a price range and contractor contracts." },
      { property: "og:title", content: "Get a quote · SnapQuote" },
      { property: "og:description", content: "Upload a photo, preview the replacement and get a price range and contractor contracts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuotePage,
});

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function QuotePage() {
  const [step, setStep] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const painterRef = useRef<MaskPainter | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [customText, setCustomText] = useState("");

  const [rendering, setRendering] = useState(false);
  const [option, setOption] = useState<ReplacementOption | null>(null);
  const [after, setAfter] = useState<{ image: string; mode: "inpaint" | "img2img" } | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  const config = useQuery({ queryKey: ["snapquote-config"], queryFn: api.config, retry: 1 });
  const regions = config.data?.regions ?? [];

  useEffect(() => {
    if (config.error) toast.error(errMsg(config.error));
  }, [config.error]);
  useEffect(() => {
    if (!region && regions[0]) setRegion(regions[0]);
  }, [regions, region]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const analyze = async () => {
    if (!image) return;
    setAnalyzing(true);
    try {
      const res = await api.analyze(image, region);
      setDetection(res.detection);
      setSelected(0);
      setStep(2);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const visualize = async () => {
    if (!image || !detection || selected === null) return;
    const chosen: ReplacementOption =
      selected === CUSTOM
        ? { name: customText.trim(), prompt: customText.trim() }
        : (detection.replacement_options[selected] as ReplacementOption);
    setRendering(true);
    try {
      const [vis, est] = await Promise.all([
        api.visualize(image, chosen.prompt, painterRef.current?.getMask() ?? null),
        api.estimate(detection, chosen, region),
      ]);
      setOption(chosen);
      setAfter(vis);
      setEstimate(est.estimate);
      setStep(3);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setRendering(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-10">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Get your quote</h1>
        <p className="text-page-muted">Four quick steps. Takes about a minute.</p>
      </div>
      <StepProgress step={step} />

      {/* Kept mounted so painted areas survive going back and forth. */}
      <div hidden={step !== 1} className="max-w-3xl">
        <UploadStep
          image={image}
          onImage={(img) => {
            setImage(img);
            setDetection(null);
          }}
          region={region}
          onRegion={setRegion}
          regions={regions}
          regionsLoading={config.isLoading}
          painterRef={painterRef}
          analyzing={analyzing}
          onAnalyze={analyze}
        />
      </div>

      {step === 2 && detection && (
        <div className="max-w-4xl">
          <DetectionStep
            detection={detection}
            selected={selected}
            onSelect={setSelected}
            customText={customText}
            onCustomText={setCustomText}
            loading={rendering}
            onBack={() => setStep(1)}
            onContinue={visualize}
          />
        </div>
      )}

      {step === 3 && image && after && estimate && (
        <PreviewStep
          before={image}
          after={after.image}
          mode={after.mode}
          estimate={estimate}
          region={region}
          onBack={() => setStep(2)}
          onContinue={() => setStep(4)}
        />
      )}

      {step === 4 && image && detection && option && estimate && (
        <div className="max-w-3xl">
          <ContractStep
            region={region}
            detection={detection}
            option={option}
            estimate={estimate}
            before={image}
            after={after?.image ?? null}
            onBack={() => setStep(3)}
          />
        </div>
      )}
    </main>
  );
}
