import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import {
  Lock, Clock, CheckCircle2, Loader2, ArrowLeft, AlertTriangle, ShieldCheck,
  FileText, ArrowRight
} from "lucide-react";
import { LoadingState, EmptyState } from "@/components/EmptyState";
import { formatCurrency, PROPERTY_TYPES } from "@/lib/rental-utils";

export default function Reserve() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState("summary"); // summary → paying → confirmed
  const [reservation, setReservation] = useState(null);
  const [payment, setPayment] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const lst = await zimrent.entities.Listing.get(listingId);
        setListing(lst);
        if (lst) {
          const prop = await zimrent.entities.Property.get(lst.data?.property_id);
          setProperty(prop);
          // Check for existing pending reservation
          const existing = await zimrent.entities.Reservation.filter({
            listing_id: listingId,
            tenant_id: user.id,
            status: { $in: ["payment_pending", "active"] }
          });
          if (existing && existing.length > 0) {
            setReservation(existing[0]);
            if (existing[0].data?.status === "payment_pending") {
              // Find the payment
              const payments = await zimrent.entities.Payment.filter({ reservation_id: existing[0].id });
              if (payments && payments.length > 0) {
                setPayment(payments[0]);
                setStep("paying");
              }
            } else if (existing[0].data?.status === "active") {
              setStep("confirmed");
            }
          }
        }
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [listingId, user]);

  const handleReserve = async () => {
    setProcessing(true);
    setError("");
    try {
      const result = await zimrent.functions.invoke("createReservation", { listing_id: listingId });
      const res = result.data;
      if (res.error) throw new Error(res.error);
      setReservation(res.reservation);
      setPayment(res.payment);
      setStep("paying");
    } catch (e) { setError(e.message || "Failed to create reservation. The property may have just been reserved by another tenant."); }
    finally { setProcessing(false); }
  };

  const handlePay = async () => {
    setProcessing(true);
    setError("");
    try {
      // This simulates the payment provider webhook confirmation.
      // In production, the provider would call the backend directly.
      // Here, the backend confirms — the frontend never determines success.
      const result = await zimrent.functions.invoke("confirmTestPayment", { payment_id: payment.id });
      const res = result.data;
      if (res.error) throw new Error(res.error);
      setStep("confirmed");
    } catch (e) { setError(e.message); }
    finally { setProcessing(false); }
  };

  if (loading) return <LoadingState label="Loading reservation details..." />;
  if (!listing || !property) return <EmptyState icon={AlertTriangle} title="Listing not found" action={<Button onClick={() => navigate("/")}>Back to search</Button>} />;

  const listingData = listing.data;
  const propData = property.data;
  const reservationFee = listingData.reservation_fee || 25;
  const durationHours = listingData.reservation_duration_hours || 48;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to={`/property/${property.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to property
      </Link>

      {step === "summary" && (
        <>
          <h1 className="text-2xl font-bold font-heading mb-1">Reserve this property</h1>
          <p className="text-muted-foreground text-sm mb-6">A small reservation payment temporarily secures the property while you complete your application.</p>

          <Card className="border-border mb-4">
            <div className="aspect-[16/9] bg-muted rounded-t-2xl overflow-hidden">
              <Image src={propData.photos?.[0] || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"} alt={propData.title} className="w-full h-full" fittingType="fill" />
            </div>
            <CardContent className="p-5">
              <h2 className="font-semibold font-heading">{propData.title}</h2>
              <p className="text-sm text-muted-foreground">{propData.suburb}, {propData.city} · {PROPERTY_TYPES[propData.property_type]}</p>
            </CardContent>
          </Card>

          <Card className="border-border mb-4">
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monthly rent</span>
                <span className="font-medium">{formatCurrency(listingData.monthly_rent, listingData.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Security deposit</span>
                <span className="font-medium">{formatCurrency(listingData.security_deposit, listingData.currency)}</span>
              </div>
              <div className="flex justify-between text-sm pt-3 border-t border-border">
                <span className="font-semibold">Reservation fee (due now)</span>
                <span className="font-bold text-primary text-lg">{formatCurrency(reservationFee, listingData.currency)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border mb-4 bg-muted/30">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm mb-3">What happens next</h3>
              <div className="space-y-3">
                {[
                  { icon: Lock, text: "Property becomes reserved for you — other tenants cannot reserve it" },
                  { icon: Clock, text: `You have ${durationHours} hours to complete your application` },
                  { icon: FileText, text: "Submit your rental application" },
                  { icon: ShieldCheck, text: "If approved, sign the rental agreement and pay deposit + first rent" }
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <s.icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground pt-1">{s.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <Button onClick={handleReserve} disabled={processing} className="w-full h-12">
            {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating reservation...</> : <><Lock className="w-4 h-4 mr-2" /> Reserve & pay {formatCurrency(reservationFee, listingData.currency)}</>}
          </Button>
        </>
      )}

      {step === "paying" && (
        <>
          <h1 className="text-2xl font-bold font-heading mb-1">Complete payment</h1>
          <p className="text-muted-foreground text-sm mb-6">Your reservation has been created. Complete the payment to activate it.</p>

          <Card className="border-border mb-4">
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Property</span>
                <span className="font-medium text-right">{propData.title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reservation fee</span>
                <span className="font-bold text-primary">{formatCurrency(reservationFee, listingData.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reservation period</span>
                <span className="font-medium">{durationHours} hours</span>
              </div>
            </CardContent>
          </Card>

          {/* Test payment notice */}
          <div className="p-4 bg-warning/5 border border-warning/20 rounded-xl mb-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-warning">Test / Demo payment</p>
              <p className="text-xs text-muted-foreground mt-1">
                No live payment provider (EcoCash, ZIPIT, bank) is connected yet. This is a clearly-labeled test transaction — no real money is charged. The payment architecture (PaymentService abstraction, ledger, webhook handler) is production-ready; only the provider adapter is a mock.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <Button onClick={handlePay} disabled={processing} className="w-full h-12">
            {processing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming payment...</> : <>Pay {formatCurrency(reservationFee, listingData.currency)} (Test)</>}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Payment confirmation is handled by the backend, not the browser.
          </p>
        </>
      )}

      {step === "confirmed" && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold font-heading">Reservation confirmed!</h1>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            "{propData.title}" is now reserved for you for {durationHours} hours. Complete your application to proceed with the rental.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <Button onClick={() => navigate(`/apply/${listingId}`)}>
              Complete application <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={() => navigate("/tenant-dashboard")}>Go to dashboard</Button>
          </div>
        </div>
      )}
    </div>
  );
}