import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Users, Building2, AlertTriangle, FileText, CreditCard,
  Loader2, CheckCircle2, XCircle, RefreshCw, Flag, Star
} from "lucide-react";
import StateBadge from "@/components/StateBadge";
import { EmptyState, LoadingState } from "@/components/EmptyState";
import { LISTING_STATUS, formatCurrency, formatDate } from "@/lib/rental-utils";

export default function AdminDashboard() {
  const { user, isAdmin: isAuthAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [properties, setProperties] = useState([]);
  const [listings, setListings] = useState([]);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [expiring, setExpiring] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") { navigate("/"); return; }
    (async () => {
      try {
        const [profs, props, lsts, frauds, audits, pays, reps, revs] = await Promise.all([
          zimrent.entities.Profile.filter({}, "-created_date", 50),
          zimrent.entities.Property.filter({}, "-created_date", 50),
          zimrent.entities.Listing.filter({}, "-created_date", 50),
          zimrent.entities.FraudAlert.filter({}, "-created_date", 50),
          zimrent.entities.AuditLog.filter({}, "-created_date", 50),
          zimrent.entities.Payment.filter({}, "-created_date", 50),
          zimrent.entities.Report.filter({}, "-created_date", 50),
          zimrent.entities.Review.filter({}, "-created_date", 50)
        ]);
        setProfiles(profs || []);
        setProperties(props || []);
        setListings(lsts || []);
        setFraudAlerts(frauds || []);
        setAuditLogs(audits || []);
        setPayments(pays || []);
        setReports(reps || []);
        setReviews(revs || []);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [user, navigate]);

  const verifyProperty = async (propertyId, status) => {
    try {
      await zimrent.entities.Property.update(propertyId, {
        verification_status: status,
        verified_at: status === "verified" ? new Date().toISOString() : ""
      });
      setProperties(prev => prev.map(p => p.id === propertyId ? { ...p, data: { ...p.data, verification_status: status } } : p));
    } catch (e) { alert(e.message); }
  };

  const approveListing = async (listingId, approve) => {
    try {
      const newStatus = approve ? "active" : "draft";
      const result = await zimrent.functions.invoke("transitionListing", { listing_id: listingId, new_status: newStatus });
      if (result.data?.error) throw new Error(result.data.error);
      // Also verify the property when approving the listing
      if (approve) {
        const listing = listings.find(l => l.id === listingId);
        if (listing) {
          await zimrent.entities.Property.update(listing.data?.property_id, {
            verification_status: "verified",
            verified_at: new Date().toISOString()
          });
          setProperties(prev => prev.map(p => p.id === listing.data?.property_id ? { ...p, data: { ...p.data, verification_status: "verified" } } : p));
        }
      }
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, data: { ...l.data, status: newStatus } } : l));
    } catch (e) { alert(e.message); }
  };

  const resolveFraud = async (alertId, status, resolution) => {
    try {
      await zimrent.entities.FraudAlert.update(alertId, { status, resolution: resolution || "" });
      setFraudAlerts(prev => prev.map(f => f.id === alertId ? { ...f, data: { ...f.data, status, resolution } } : f));
    } catch (e) { alert(e.message); }
  };

  const resolveReport = async (reportId, status, note) => {
    try {
      await zimrent.entities.Report.update(reportId, { status, admin_note: note || "", resolved_by: user.id });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, data: { ...r.data, status, admin_note: note } } : r));
    } catch (e) { alert(e.message); }
  };

  const verifyIdentity = async (profileId, status) => {
    try {
      await zimrent.entities.Profile.update(profileId, {
        identity_status: status === "approve" ? "identity_verified" : "verification_failed",
        identity_verified_at: status === "approve" ? new Date().toISOString() : ""
      });
      await zimrent.entities.AuditLog.create({
        actor_id: user.id, actor_email: user.email,
        action: "IDENTITY_VERIFICATION_DECISION", resource_type: "profile", resource_id: profileId,
        result: "success", details: `Identity ${status === "approve" ? "verified" : "rejected"} by admin`
      });
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, data: { ...p.data, identity_status: status === "approve" ? "identity_verified" : "verification_failed" } } : p));
    } catch (e) { alert(e.message); }
  };

  const expireReservations = async () => {
    setExpiring(true);
    try {
      await zimrent.functions.invoke("expireReservations", {});
      alert("Reservations checked and expired.");
    } catch (e) { alert(e.message); }
    finally { setExpiring(false); }
  };

  if (loading) return <LoadingState label="Loading admin console..." />;

  const unverifiedProperties = properties.filter(p => p.data?.verification_status === "unverified" || p.data?.verification_status === "pending");
  const pendingListings = listings.filter(l => l.data?.status === "pending_verification");
  const openFraud = fraudAlerts.filter(f => f.data?.status === "open" || f.data?.status === "under_review");
  const openReports = reports.filter(r => r.data?.status === "open" || r.data?.status === "under_review");
  const pendingIdentity = profiles.filter(p => p.data?.identity_status === "identity_pending" || p.data?.identity_status === "verification_review");
  const flaggedReviews = reviews.filter(r => r.data?.status === "flagged");
  const totalPayments = payments.filter(p => p.data?.status === "success").reduce((sum, p) => sum + (p.data?.amount || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Admin Console</h1>
          <p className="text-sm text-muted-foreground">Platform operations and oversight</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Users" value={profiles.length} />
        <StatCard icon={Building2} label="Properties" value={properties.length} />
        <StatCard icon={AlertTriangle} label="Open fraud alerts" value={openFraud.length} color={openFraud.length > 0 ? "warning" : "secondary"} />
        <StatCard icon={CreditCard} label="Payments volume" value={formatCurrency(totalPayments, "USD")} />
      </div>

      <Button variant="outline" onClick={expireReservations} disabled={expiring} className="mb-5">
        {expiring ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...</> : <><RefreshCw className="w-4 h-4 mr-2" /> Expire stale reservations</>}
      </Button>

      <Tabs defaultValue="verification" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 mb-5">
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="fraud">Fraud ({openFraud.length})</TabsTrigger>
          <TabsTrigger value="reports">Reports ({openReports.length})</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="verification" className="space-y-3">
          {/* Pending listing approvals */}
          {pendingListings.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-sm mb-3">Listing approvals pending</h3>
              {pendingListings.map(l => {
                const prop = properties.find(p => p.id === l.data?.property_id);
                return (
                  <Card key={l.id} className="border-border mb-2">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{prop?.data?.title || l.data?.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(l.data?.monthly_rent, l.data?.currency)}/mo · {prop?.data?.suburb}, {prop?.data?.city}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="border-destructive/30 text-destructive" onClick={() => approveListing(l.id, false)}>
                          <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => approveListing(l.id, true)}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {/* Identity verification queue */}
          {pendingIdentity.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-sm mb-3">Identity verification requests</h3>
              {pendingIdentity.map(p => (
                <Card key={p.id} className="border-border mb-2">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{p.data?.full_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.data?.role} · {p.data?.city || "No city"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-destructive/30 text-destructive" onClick={() => verifyIdentity(p.id, "reject")}>
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => verifyIdentity(p.id, "approve")}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Verify
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {/* Property verification queue */}
          <h3 className="font-semibold text-sm mb-3">Property verification queue</h3>
          {unverifiedProperties.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All properties verified" description="No properties pending verification." />
          ) : unverifiedProperties.map(p => (
            <Card key={p.id} className="border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{p.data?.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.data?.suburb}, {p.data?.city}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-destructive/30 text-destructive" onClick={() => verifyProperty(p.id, "rejected")}>
                    <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                  </Button>
                  <Button size="sm" onClick={() => verifyProperty(p.id, "verified")}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Verify
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3">
          {openReports.length === 0 ? (
            <EmptyState icon={Flag} title="No open reports" description="User-submitted reports will appear here for review." />
          ) : openReports.map(r => (
            <Card key={r.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StateBadge status={r.data?.reason} label={r.data?.reason?.replace(/_/g, " ")} color="warning" />
                    <span className="text-xs text-muted-foreground">{r.data?.target_type}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => resolveReport(r.id, "dismissed", "Reviewed and dismissed")}>Dismiss</Button>
                    <Button size="sm" variant="outline" className="border-destructive/30 text-destructive" onClick={() => resolveReport(r.id, "resolved", "Investigated and resolved")}>Resolve</Button>
                  </div>
                </div>
                {r.data?.description && <p className="text-sm text-muted-foreground">{r.data.description}</p>}
                <p className="text-xs text-muted-foreground mt-1">Reported on {formatDate(r.created_date)}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="payments" className="space-y-3">
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments" description="Platform transactions will appear here." />
          ) : payments.map(p => (
            <Card key={p.id} className="border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm capitalize">{p.data?.type} · {p.data?.provider}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(p.data?.completed_at || p.created_date)}{p.data?.is_test && " · Test"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(p.data?.amount, p.data?.currency)}</p>
                  <StateBadge status={p.data?.status} label={p.data?.status} color={p.data?.status === "success" ? "success" : p.data?.status === "failed" ? "destructive" : "warning"} />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-3">
          {flaggedReviews.length === 0 ? (
            <EmptyState icon={Star} title="No flagged reviews" description="Reported reviews will appear here for moderation." />
          ) : flaggedReviews.map(r => (
            <Card key={r.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= r.data?.rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`} />)}</div>
                  <StateBadge status={r.data?.status} label={r.data?.status} color="warning" />
                </div>
                {r.data?.comment && <p className="text-sm text-muted-foreground">{r.data.comment}</p>}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={async () => {
                    await zimrent.entities.Review.update(r.id, { status: "visible" });
                    setReviews(prev => prev.map(x => x.id === r.id ? { ...x, data: { ...x.data, status: "visible" } } : x));
                  }}>Approve</Button>
                  <Button size="sm" variant="outline" className="border-destructive/30 text-destructive" onClick={async () => {
                    await zimrent.entities.Review.update(r.id, { status: "hidden" });
                    setReviews(prev => prev.map(x => x.id === r.id ? { ...x, data: { ...x.data, status: "hidden" } } : x));
                  }}>Hide</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="fraud" className="space-y-3">
          {fraudAlerts.length === 0 ? (
            <EmptyState icon={Shield} title="No fraud alerts" description="The system monitors for suspicious activity automatically." />
          ) : fraudAlerts.map(f => (
            <Card key={f.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StateBadge status={f.data?.risk_level} label={f.data?.risk_level?.toUpperCase()} color={f.data?.risk_level === "critical" ? "destructive" : f.data?.risk_level === "high" ? "warning" : "secondary"} />
                    <StateBadge status={f.data?.status} label={f.data?.status?.replace(/_/g, " ")} color={f.data?.status === "open" ? "warning" : f.data?.status === "suspended" ? "destructive" : "success"} />
                  </div>
                  {(f.data?.status === "open" || f.data?.status === "under_review") && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => resolveFraud(f.id, "cleared", "Reviewed and cleared")}>Clear</Button>
                      <Button size="sm" variant="outline" className="border-destructive/30 text-destructive" onClick={() => resolveFraud(f.id, "suspended", "Suspended for investigation")}>Suspend</Button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{f.data?.description}</p>
                {f.data?.signals && f.data?.signals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {f.data.signals.map((s, i) => <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">{s}</span>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="properties" className="space-y-3">
          {listings.length === 0 ? (
            <EmptyState icon={Building2} title="No listings" description="Property listings will appear here." />
          ) : listings.map(l => {
            const prop = properties.find(p => p.id === l.data?.property_id);
            const info = LISTING_STATUS[l.data?.status];
            const isPending = l.data?.status === "pending_verification";
            return (
              <Card key={l.id} className="border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{prop?.data?.title || l.data?.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(l.data?.monthly_rent, l.data?.currency)}/mo · {prop?.data?.suburb}, {prop?.data?.city}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPending && (
                      <>
                        <Button size="sm" variant="outline" className="border-destructive/30 text-destructive" onClick={() => approveListing(l.id, false)}>
                          <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => approveListing(l.id, true)}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
                        </Button>
                      </>
                    )}
                    <StateBadge status={l.data?.status} label={info?.label} color={info?.color} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="audit" className="space-y-2">
          {auditLogs.length === 0 ? (
            <EmptyState icon={FileText} title="No audit entries" />
          ) : auditLogs.map(a => (
            <Card key={a.id} className="border-border">
              <CardContent className="p-3 flex items-center gap-3 text-sm">
                <StateBadge status={a.data?.result} label={a.data?.result} color={a.data?.result === "success" ? "success" : a.data?.result === "denied" ? "destructive" : "warning"} />
                <div className="flex-1">
                  <p className="font-medium">{a.data?.action?.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{a.data?.actor_email || "system"} · {formatDate(a.created_date)}</p>
                </div>
                {a.data?.resource_type && <span className="text-xs text-muted-foreground capitalize">{a.data.resource_type}</span>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color = "primary" }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    secondary: "bg-muted text-muted-foreground"
  };
  return (
    <Card className="border-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xl font-bold font-heading leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}