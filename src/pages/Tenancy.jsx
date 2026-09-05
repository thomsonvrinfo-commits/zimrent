import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Home, Wrench, FileText, Bell, CreditCard, Loader2,
  Plus, ArrowLeft, Star, Send, ClipboardCheck
} from "lucide-react";
import StateBadge from "@/components/StateBadge";
import { LoadingState, EmptyState } from "@/components/EmptyState";
import InspectionPanel from "@/components/InspectionPanel";
import { formatCurrency, formatDate, MAINTENANCE_STATUS } from "@/lib/rental-utils";

export default function Tenancy() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tenancy, setTenancy] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [notices, setNotices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maintModal, setMaintModal] = useState(false);
  const [noticeModal, setNoticeModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [maintForm, setMaintForm] = useState({ category: "plumbing", description: "", priority: "medium", location_in_property: "" });
  const [noticeForm, setNoticeForm] = useState({ notice_type: "termination", content: "", effective_date: "" });
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Try loading as tenancy first, then as agreement (for the "Go to rental workspace" link from agreement)
        let tenancyData = null;
        try {
          tenancyData = await zimrent.entities.Tenancy.get(id);
        } catch (e) {
          // Maybe it's an agreement id — find the tenancy
          const tens = await zimrent.entities.Tenancy.filter({ agreement_id: id });
          if (tens && tens.length > 0) tenancyData = tens[0];
        }
        if (!tenancyData) return;
        setTenancy(tenancyData);
        const d = tenancyData.data;

        const [agreementData, maints, nts, pays] = await Promise.all([
          d.agreement_id ? zimrent.entities.RentalAgreement.get(d.agreement_id) : Promise.resolve(null),
          zimrent.entities.MaintenanceRequest.filter({ tenancy_id: tenancyData.id }, "-created_date", 20),
          zimrent.entities.Notice.filter({ tenancy_id: tenancyData.id }, "-created_date", 20),
          zimrent.entities.Payment.filter({ tenancy_id: tenancyData.id }, "-created_date", 20)
        ]);
        setAgreement(agreementData);
        setMaintenance(maints || []);
        setNotices(nts || []);
        setPayments(pays || []);
        // Check if tenant has already reviewed this property
        if (tenancyData.data?.tenant_id === user?.id) {
          const existingReviews = await zimrent.entities.Review.filter({ reviewer_id: user.id, target_type: "property", target_id: tenancyData.data?.property_id });
          setHasReviewed(existingReviews && existingReviews.length > 0);
        }
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [id]);

  const isTenant = tenancy?.data?.tenant_id === user?.id;

  const submitReview = async () => {
    if (!reviewForm.comment) { alert("Please write a review comment"); return; }
    setSubmittingReview(true);
    try {
      await zimrent.entities.Review.create({
        reviewer_id: user.id,
        target_type: "property",
        target_id: tenancy.data?.property_id,
        listing_id: tenancy.data?.listing_id,
        tenancy_id: tenancy.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
        status: "visible"
      });
      setReviewModal(false);
      setReviewForm({ rating: 5, comment: "" });
      setHasReviewed(true);
      alert("Thank you! Your review has been submitted.");
    } catch (e) { alert(e.message); }
    finally { setSubmittingReview(false); }
  };

  const payRent = async () => {
    setPaying(true);
    try {
      // Test rent payment — same mock provider as reservations
      const payment = await zimrent.entities.Payment.create({
        user_id: user.id,
        tenancy_id: tenancy.id,
        property_id: tenancy.data?.property_id,
        provider: "mock",
        provider_reference: "test_rent_" + Date.now(),
        amount: tenancy.data?.rent,
        currency: tenancy.data?.currency,
        type: "rent",
        status: "initiated",
        is_test: true
      });
      // Confirm via the same backend confirmation path
      await zimrent.functions.invoke("confirmTestPayment", { payment_id: payment.id });
      // Update next payment due
      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + 1);
      await zimrent.entities.Tenancy.update(tenancy.id, {
        next_payment_due: nextDue.toISOString().substring(0, 10),
        outstanding_balance: 0
      });
      setPayments(prev => [...prev, { ...payment, data: { ...payment.data, status: "success", completed_at: new Date().toISOString() } }]);
      const updated = await zimrent.entities.Tenancy.get(tenancy.id);
      setTenancy(updated);
      alert("Rent payment confirmed (test). A receipt has been recorded.");
    } catch (e) { alert(e.message); }
    finally { setPaying(false); }
  };

  const submitMaintenance = async () => {
    if (!maintForm.description) { alert("Please describe the issue"); return; }
    try {
      await zimrent.entities.MaintenanceRequest.create({
        tenancy_id: tenancy.id,
        property_id: tenancy.data?.property_id,
        property_title: tenancy.data?.property_title,
        tenant_id: user.id,
        owner_id: tenancy.data?.owner_id,
        category: maintForm.category,
        description: maintForm.description,
        priority: maintForm.priority,
        location_in_property: maintForm.location_in_property,
        status: "submitted"
      });
      await zimrent.entities.Notification.create({
        user_id: tenancy.data?.owner_id, type: "MAINTENANCE_REQUEST",
        title: "New maintenance request", message: `A maintenance issue was reported for "${tenancy.data?.property_title}".`,
        link: "/owner-dashboard"
      });
      setMaintModal(false);
      setMaintForm({ category: "plumbing", description: "", priority: "medium", location_in_property: "" });
      const maints = await zimrent.entities.MaintenanceRequest.filter({ tenancy_id: tenancy.id }, "-created_date", 20);
      setMaintenance(maints || []);
    } catch (e) { alert(e.message); }
  };

  const submitNotice = async () => {
    if (!noticeForm.content) { alert("Please enter notice content"); return; }
    try {
      const recipientId = isTenant ? tenancy.data?.owner_id : tenancy.data?.tenant_id;
      await zimrent.entities.Notice.create({
        tenancy_id: tenancy.id,
        property_id: tenancy.data?.property_id,
        property_title: tenancy.data?.property_title,
        sender_id: user.id,
        recipient_id: recipientId,
        notice_type: noticeForm.notice_type,
        content: noticeForm.content,
        effective_date: noticeForm.effective_date,
        status: "sent"
      });
      await zimrent.entities.Notification.create({
        user_id: recipientId, type: "NOTICE_RECEIVED",
        title: "Notice received", message: `A notice was submitted for "${tenancy.data?.property_title}".`,
        link: isTenant ? "/owner-dashboard" : "/tenant-dashboard"
      });
      setNoticeModal(false);
      setNoticeForm({ notice_type: "termination", content: "", effective_date: "" });
      const nts = await zimrent.entities.Notice.filter({ tenancy_id: tenancy.id }, "-created_date", 20);
      setNotices(nts || []);
    } catch (e) { alert(e.message); }
  };

  if (loading) return <LoadingState label="Loading your rental..." />;
  if (!tenancy) return <EmptyState icon={Home} title="Rental not found" action={<Button onClick={() => navigate("/")}>Go home</Button>} />;

  const d = tenancy.data;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to={isTenant ? "/tenant-dashboard" : "/owner-dashboard"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Home className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold font-heading">{d.property_title}</h1>
          <p className="text-sm text-muted-foreground">Active tenancy · Started {formatDate(d.start_date)}</p>
        </div>
        <StateBadge status={d.status} label={d.status === "active" ? "Active" : d.status} color="success" />
      </div>

      {/* Rent card */}
      <Card className="border-border mb-5">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Monthly rent</p>
              <p className="text-2xl font-bold font-heading text-primary">{formatCurrency(d.rent, d.currency)}</p>
              <p className="text-xs text-muted-foreground mt-1">Next payment due: {formatDate(d.next_payment_due)}</p>
            </div>
            {isTenant && (
              <Button onClick={payRent} disabled={paying}>
                {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : <><CreditCard className="w-4 h-4 mr-2" /> Pay rent (Test)</>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="maintenance" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-6 mb-5">
          <TabsTrigger value="maintenance"><Wrench className="w-4 h-4 mr-1.5" /> Maintenance</TabsTrigger>
          <TabsTrigger value="inspections"><ClipboardCheck className="w-4 h-4 mr-1.5" /> Inspections</TabsTrigger>
          <TabsTrigger value="notices"><Bell className="w-4 h-4 mr-1.5" /> Notices</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="w-4 h-4 mr-1.5" /> Payments</TabsTrigger>
          <TabsTrigger value="agreement"><FileText className="w-4 h-4 mr-1.5" /> Agreement</TabsTrigger>
          <TabsTrigger value="review"><Star className="w-4 h-4 mr-1.5" /> Review</TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance" className="space-y-3">
          {isTenant && (
            <Button variant="outline" onClick={() => setMaintModal(true)} className="mb-2">
              <Plus className="w-4 h-4 mr-2" /> Report maintenance issue
            </Button>
          )}
          {maintenance.length === 0 ? (
            <EmptyState icon={Wrench} title="No maintenance requests" description="Report issues like plumbing, electrical, or structural problems." />
          ) : maintenance.map(m => {
            const info = MAINTENANCE_STATUS[m.data?.status];
            return (
              <Card key={m.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm capitalize">{m.data?.category} · {m.data?.priority} priority</p>
                    <StateBadge status={m.data?.status} label={info?.label} color={info?.color} />
                  </div>
                  <p className="text-sm text-muted-foreground">{m.data?.description}</p>
                  {m.data?.location_in_property && <p className="text-xs text-muted-foreground mt-1">Location: {m.data.location_in_property}</p>}
                  {m.data?.owner_response && <p className="text-xs mt-2 pt-2 border-t border-border text-muted-foreground">Owner response: {m.data.owner_response}</p>}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="inspections">
          <InspectionPanel tenancy={tenancy} />
        </TabsContent>

        <TabsContent value="notices" className="space-y-3">
          <Button variant="outline" onClick={() => setNoticeModal(true)} className="mb-2">
            <Plus className="w-4 h-4 mr-2" /> Submit notice
          </Button>
          {notices.length === 0 ? (
            <EmptyState icon={Bell} title="No notices" description="Submit formal notices like termination, maintenance escalation, or payment issues." />
          ) : notices.map(n => (
            <Card key={n.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm capitalize">{n.data?.notice_type?.replace(/_/g, " ")}</p>
                  <StateBadge status={n.data?.status} label={n.data?.status} color={n.data?.status === "sent" ? "warning" : "success"} />
                </div>
                <p className="text-sm text-muted-foreground">{n.data?.content}</p>
                {n.data?.effective_date && <p className="text-xs text-muted-foreground mt-1">Effective: {formatDate(n.data?.effective_date)}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="payments" className="space-y-3">
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments recorded" description="Rent payments will appear here with receipts." />
          ) : payments.map(p => (
            <Card key={p.id} className="border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm capitalize">{p.data?.type} payment</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(p.data?.completed_at || p.created_date)} · {p.data?.is_test ? "Test transaction" : "Live"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(p.data?.amount, p.data?.currency)}</p>
                  <StateBadge status={p.data?.status} label={p.data?.status} color={p.data?.status === "success" ? "success" : "warning"} />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="agreement">
          {agreement ? (
            <Card className="border-border">
              <CardContent className="p-5 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Rent</span><span className="font-medium">{formatCurrency(agreement.data?.rent, agreement.data?.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deposit</span><span className="font-medium">{formatCurrency(agreement.data?.deposit, agreement.data?.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Start date</span><span className="font-medium">{formatDate(agreement.data?.start_date)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Notice period</span><span className="font-medium">{agreement.data?.notice_period_days} days</span></div>
                {agreement.data?.terms && <div className="pt-3 border-t border-border"><p className="text-xs text-muted-foreground mb-1">Terms</p><p className="whitespace-pre-wrap">{agreement.data.terms}</p></div>}
                <Button variant="outline" asChild className="w-full mt-3"><Link to={`/agreement/${agreement.id}`}>View full agreement</Link></Button>
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={FileText} title="No agreement found" />
          )}
        </TabsContent>

        <TabsContent value="review">
          {isTenant ? (
            hasReviewed ? (
              <EmptyState icon={Star} title="Review submitted" description="You've already reviewed this property. Thank you for your feedback!" />
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-4">Share your experience to help other tenants and improve the platform.</p>
                <Button onClick={() => setReviewModal(true)} className="mb-4">
                  <Star className="w-4 h-4 mr-2" /> Write a review
                </Button>
              </div>
            )
          ) : (
            <EmptyState icon={Star} title="Tenant reviews" description="Reviews are submitted by tenants after their rental experience." />
          )}
        </TabsContent>
      </Tabs>

      {/* Maintenance modal */}
      <Dialog open={maintModal} onOpenChange={setMaintModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report maintenance issue</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={maintForm.category} onValueChange={(v) => setMaintForm({ ...maintForm, category: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="electrical">Electrical</SelectItem>
                    <SelectItem value="structural">Structural</SelectItem>
                    <SelectItem value="appliance">Appliance</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="pest">Pest</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={maintForm.priority} onValueChange={(v) => setMaintForm({ ...maintForm, priority: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Location in property</Label>
              <Input value={maintForm.location_in_property} onChange={(e) => setMaintForm({ ...maintForm, location_in_property: e.target.value })} className="mt-1.5" placeholder="e.g. Kitchen, main bathroom" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={maintForm.description} onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })} className="mt-1.5" rows={4} placeholder="Describe the issue in detail" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintModal(false)}>Cancel</Button>
            <Button onClick={submitMaintenance}>Submit request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notice modal */}
      <Dialog open={noticeModal} onOpenChange={setNoticeModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit formal notice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Notice type</Label>
                <Select value={noticeForm.notice_type} onValueChange={(v) => setNoticeForm({ ...noticeForm, notice_type: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="termination">Termination notice</SelectItem>
                    <SelectItem value="maintenance_escalation">Maintenance escalation</SelectItem>
                    <SelectItem value="payment_issue">Payment issue</SelectItem>
                    <SelectItem value="rent_review">Rent review</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Effective date</Label>
                <Input type="date" value={noticeForm.effective_date} onChange={(e) => setNoticeForm({ ...noticeForm, effective_date: e.target.value })} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Content</Label>
              <Textarea value={noticeForm.content} onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })} className="mt-1.5" rows={4} placeholder="Enter the notice details" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoticeModal(false)}>Cancel</Button>
            <Button onClick={submitNotice}>Submit notice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review modal */}
      <Dialog open={reviewModal} onOpenChange={setReviewModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review your rental</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="flex gap-2 mt-2">
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setReviewForm({ ...reviewForm, rating: i })}>
                    <Star className={`w-8 h-8 ${i <= reviewForm.rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Comment</Label>
              <Textarea value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} className="mt-1.5" rows={4} placeholder="Share your experience living at this property" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewModal(false)}>Cancel</Button>
            <Button onClick={submitReview} disabled={submittingReview}>
              {submittingReview ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4 mr-2" /> Submit review</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}