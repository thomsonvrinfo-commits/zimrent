import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, FileText, CheckCircle2, XCircle } from "lucide-react";
import { LoadingState, EmptyState } from "@/components/EmptyState";
import { IdentityBadge } from "@/components/VerificationBadge";
import StateBadge from "@/components/StateBadge";
import { APPLICATION_STATUS, formatDate } from "@/lib/rental-utils";

export default function ApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [application, setApplication] = useState(null);
  const [tenantProfile, setTenantProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [ownerNote, setOwnerNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const app = await zimrent.entities.Application.get(id);
        setApplication(app);
        if (app) {
          const profiles = await zimrent.entities.Profile.filter({ created_by_id: app.data?.tenant_id });
          if (profiles[0]) setTenantProfile(profiles[0]);
        }
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [id]);

  const handleDecision = async (decision) => {
    setProcessing(true);
    try {
      const result = await zimrent.functions.invoke("acceptApplication", {
        application_id: id, decision, owner_note: ownerNote
      });
      const res = result.data;
      if (res.error) throw new Error(res.error);
      if (decision === "approved") {
        navigate(`/agreement/${res.agreement.id}`);
      } else {
        navigate("/owner-dashboard");
      }
    } catch (e) { alert(e.message); }
    finally { setProcessing(false); }
  };

  if (loading) return <LoadingState label="Loading application..." />;
  if (!application) return <EmptyState icon={FileText} title="Application not found" action={<Button onClick={() => navigate("/owner-dashboard")}>Back to dashboard</Button>} />;

  const d = application.data;
  const info = APPLICATION_STATUS[d.status];
  const isProcessed = d.status === "approved" || d.status === "rejected" || d.status === "withdrawn";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/owner-dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Application Review</h1>
          <p className="text-sm text-muted-foreground">{d.property_title}</p>
        </div>
        <div className="ml-auto">
          <StateBadge status={d.status} label={info?.label} color={info?.color} />
        </div>
      </div>

      {/* Tenant profile */}
      {tenantProfile && (
        <Card className="border-border mb-4">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {tenantProfile.data?.full_name?.split(" ").map(s => s[0]).slice(0, 2).join("")}
              </div>
              <div>
                <p className="font-medium">{tenantProfile.data?.full_name}</p>
                <IdentityBadge status={tenantProfile.data?.identity_status} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border text-center text-sm">
              <div><p className="font-bold">{tenantProfile.data?.completed_rentals || 0}</p><p className="text-xs text-muted-foreground">Rentals</p></div>
              <div><p className="font-bold">{tenantProfile.data?.rating > 0 ? tenantProfile.data.rating : "—"}</p><p className="text-xs text-muted-foreground">Rating</p></div>
              <div><p className="font-bold">{tenantProfile.data?.response_rate > 0 ? `${tenantProfile.data.response_rate}%` : "—"}</p><p className="text-xs text-muted-foreground">Response</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Application details */}
      <Card className="border-border mb-4">
        <CardContent className="p-5 space-y-3 text-sm">
          <Row label="Occupants" value={`${d.occupants} occupant(s)`} />
          <Row label="Desired move-in" value={formatDate(d.desired_move_in_date)} />
          {d.employment_info && <Row label="Employment / income" value={d.employment_info} />}
          {d.rental_history && <Row label="Rental history" value={d.rental_history} />}
          {d.references && <Row label="References" value={d.references} />}
          {d.pets && <Row label="Pets" value={d.pets} />}
          {d.additional_info && <Row label="Additional info" value={d.additional_info} />}
        </CardContent>
      </Card>

      {!isProcessed && (
        <>
          <div className="mb-4">
            <Label htmlFor="note">Note to tenant (optional)</Label>
            <Textarea id="note" value={ownerNote} onChange={(e) => setOwnerNote(e.target.value)} className="mt-1.5" rows={2} placeholder="Message included with your decision" />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => handleDecision("rejected")} disabled={processing}>
              <XCircle className="w-4 h-4 mr-2" /> Decline
            </Button>
            <Button className="flex-1 h-12" onClick={() => handleDecision("approved")} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Accept & create agreement
            </Button>
          </div>
        </>
      )}

      {d.status === "approved" && (
        <div className="p-4 bg-success/10 border border-success/20 rounded-xl text-sm text-success flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> This application was approved. An agreement has been created.
        </div>
      )}
      {d.status === "rejected" && (
        <div className="p-4 bg-muted rounded-xl text-sm text-muted-foreground">
          This application was declined. {d.owner_note && `"${d.owner_note}"`}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}