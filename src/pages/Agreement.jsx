import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText, CheckCircle2, Loader2, ArrowLeft, AlertTriangle, PenLine, Home, ArrowRight
} from "lucide-react";
import { LoadingState, EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDate } from "@/lib/rental-utils";

export default function Agreement() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const a = await zimrent.entities.RentalAgreement.get(id);
        setAgreement(a);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const handleSign = async () => {
    setSigning(true);
    setError("");
    try {
      const result = await zimrent.functions.invoke("signAgreement", { agreement_id: id });
      const res = result.data;
      if (res.error) throw new Error(res.error);
      if (res.tenancy) {
        navigate(`/tenancy/${res.tenancy.id}`);
      } else {
        // Reload agreement to show updated status
        const updated = await zimrent.entities.RentalAgreement.get(id);
        setAgreement(updated);
      }
    } catch (e) { setError(e.message); }
    finally { setSigning(false); }
  };

  if (loading) return <LoadingState label="Loading agreement..." />;
  if (!agreement) return <EmptyState icon={FileText} title="Agreement not found" action={<Button onClick={() => navigate("/")}>Go home</Button>} />;

  const d = agreement.data;
  const isTenant = d.tenant_id === user?.id;
  const isOwner = d.owner_id === user?.id;
  const tenantSigned = !!d.tenant_accepted_at;
  const ownerSigned = !!d.owner_accepted_at;
  const bothSigned = tenantSigned && ownerSigned;
  const mySigned = isTenant ? tenantSigned : isOwner ? ownerSigned : false;
  const isActive = d.status === "active";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to={isTenant ? "/tenant-dashboard" : "/owner-dashboard"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Rental Agreement</h1>
          <p className="text-sm text-muted-foreground">{d.property_title}</p>
        </div>
      </div>

      {isActive && (
        <Card className="border-success/30 bg-success/5 mb-5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <p className="text-sm font-medium text-success">This agreement is active. Your tenancy has been created.</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border mb-5">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Monthly rent</p>
              <p className="font-semibold text-lg">{formatCurrency(d.rent, d.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Security deposit</p>
              <p className="font-semibold text-lg">{formatCurrency(d.deposit, d.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Start date</p>
              <p className="font-medium">{formatDate(d.start_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">End date</p>
              <p className="font-medium">{d.end_date ? formatDate(d.end_date) : "Open-ended"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Notice period</p>
              <p className="font-medium">{d.notice_period_days} days</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Occupancy</p>
              <p className="font-medium">{d.occupancy} occupant(s)</p>
            </div>
          </div>

          {d.terms && (
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Terms</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{d.terms}</p>
            </div>
          )}
          {d.utility_responsibilities && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Utility responsibilities</p>
              <p className="text-sm">{d.utility_responsibilities}</p>
            </div>
          )}
          {d.rules_summary && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Rules</p>
              <p className="text-sm">{d.rules_summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signing status */}
      <Card className="border-border mb-5">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold text-sm">Signing status</h3>
          <SignStatus label="Tenant" signed={tenantSigned} date={d.tenant_accepted_at} />
          <SignStatus label="Owner" signed={ownerSigned} date={d.owner_accepted_at} />
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {!isActive && !mySigned && (isTenant || isOwner) && (
        <>
          <div className="p-4 bg-muted rounded-xl mb-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">By accepting this agreement, you acknowledge the terms above.</p>
            <p className="text-xs">This is an electronic acceptance within the platform. The legal enforceability of electronic lease agreements in Zimbabwe should be confirmed with a legal advisor.</p>
          </div>
          <Button onClick={handleSign} disabled={signing} className="w-full h-12">
            {signing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : <><PenLine className="w-4 h-4 mr-2" /> Accept & sign agreement</>}
          </Button>
        </>
      )}

      {!isActive && mySigned && !bothSigned && (
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl text-sm text-warning text-center">
            You've signed. Waiting for the {isTenant ? "owner" : "tenant"} to accept.
          </div>
      )}

      {isActive && (
        <Button onClick={() => navigate(`/tenancy/${id}`)} className="w-full h-12">
          <Home className="w-4 h-4 mr-2" /> Go to your rental workspace <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      )}
    </div>
  );
}

function SignStatus({ label, signed, date }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${signed ? "bg-success/10" : "bg-muted"}`}>
        {signed ? <CheckCircle2 className="w-4.5 h-4.5 text-success" style={{ width: 18, height: 18 }} /> : <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{signed ? `Signed on ${formatDate(date)}` : "Not yet signed"}</p>
      </div>
    </div>
  );
}