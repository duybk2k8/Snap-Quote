import { useState } from "react";
import { ArrowLeft, BadgeCheck, CheckCircle2, Clock, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Detection, type Estimate, type Job, type ReplacementOption } from "@/lib/snapquote-api";
import { usd } from "@/lib/quote-format";

interface Props {
  region: string;
  detection: Detection;
  option: ReplacementOption;
  estimate: Estimate;
  before: string;
  after: string | null;
  onBack: () => void;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ContractStep(p: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      const res = await api.submitJob({
        name: name.trim(),
        email: email.trim(),
        region: p.region,
        detection: p.detection,
        option: p.option,
        estimate: p.estimate,
        before: p.before,
        after: p.after,
      });
      setJobId(res.job.id);
      toast.success("Your plan was sent to contractors");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSending(false);
    }
  };

  const check = async () => {
    if (!jobId) return;
    setChecking(true);
    try {
      const res = await api.getJob(jobId);
      setJob(res.job);
      setChecked(true);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setChecking(false);
    }
  };

  const accept = async () => {
    if (!jobId) return;
    setAccepting(true);
    try {
      const res = await api.acceptContract(jobId);
      setJob(res.job);
      toast.success("Contract accepted. Your contractor will be in touch.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setAccepting(false);
    }
  };

  if (jobId) {
    const contract = job?.contract ?? null;
    const accepted = job?.status === "paid";
    return (
      <Card className="shadow-card">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-8 shrink-0 text-success" />
            <div>
              <h2 className="text-2xl font-extrabold">Plan sent to contractors</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Plan ID <span className="font-numeric rounded bg-muted px-1.5 py-0.5 font-bold text-card-foreground">{jobId}</span>
                {" "}· keep it to check back later.
              </p>
            </div>
          </div>

          <Button size="xl" variant="rust" onClick={check} disabled={checking}>
            {checking ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check for contract
          </Button>

          {checked && !contract && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted p-4 text-sm">
              <Clock className="size-4 text-rust" />
              No contract yet, contractors are reviewing your plan
            </div>
          )}

          {contract && (
            <div className="space-y-3 rounded-lg border-2 border-primary bg-highlight p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">{contract.company}</div>
                {accepted && (
                  <Badge variant="success" className="gap-1 py-1">
                    <BadgeCheck className="size-3.5" /> Accepted
                  </Badge>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Contract price</div>
                <div className="font-numeric text-4xl font-extrabold text-rust">{usd(contract.repairPrice)}</div>
              </div>
              {contract.note && <p className="text-sm">{contract.note}</p>}
              {!accepted && (
                <Button size="xl" onClick={accept} disabled={accepting} className="w-full sm:w-auto">
                  {accepting ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Accept contract
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const valid = name.trim().length > 0 && email.includes("@");

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div>
          <h2 className="text-2xl font-extrabold">Get contracts from local pros</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We send your photo, preview and estimate to contractors in {p.region}.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sq-name">Name</Label>
            <Input id="sq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Reyes" autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sq-email">Email</Label>
            <Input id="sq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jordan@example.com" autoComplete="email" />
          </div>
        </div>
        <div className="rounded-lg border border-primary bg-highlight px-3 py-2 text-sm font-semibold text-highlight-foreground">
          Demo mode: no card is charged.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="xl" onClick={p.onBack}>
            <ArrowLeft /> Back
          </Button>
          <Button size="xl" className="flex-1 sm:flex-none" disabled={!valid || sending} onClick={submit}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />} Pay $49 & send to contractors
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
