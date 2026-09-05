import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/components/ui/image";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  MapPin, Bed, Bath, Car, Sofa, ShieldCheck, Droplets, Zap, Wifi, Battery, Fuel, Trash2,
  MessageSquare, Calendar, Lock, ArrowLeft, Star, AlertTriangle, CheckCircle2, Users,
  Video, Flag, Send, Loader2
} from "lucide-react";
import { PropertyVerificationBadge, IdentityBadge } from "@/components/VerificationBadge";
import StateBadge from "@/components/StateBadge";
import EmptyState, { LoadingState } from "@/components/EmptyState";
import {
  PROPERTY_TYPES, LISTING_STATUS, formatCurrency, formatDate, isStaleAvailability,
  WATER_SOURCES, WATER_RELIABILITY, ELECTRICITY_OPTIONS, BACKUP_POWER
} from "@/lib/rental-utils";

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState(null);
  const [listing, setListing] = useState(null);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const [viewingModal, setViewingModal] = useState(false);
  const [viewingForm, setViewingForm] = useState({ requested_date: "", requested_time: "", number_of_attendees: 1, message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: "fake_property", description: "" });
  const [reporting, setReporting] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const prop = await zimrent.entities.Property.get(id);
        setProperty(prop);
        if (prop) {
          const listings = await zimrent.entities.Listing.filter({ property_id: id }, "-created_date", 5);
          if (listings && listings.length > 0) {
            setListing(listings[0]);
            const profiles = await zimrent.entities.Profile.filter({ created_by_id: listings[0].created_by_id });
            if (profiles[0]) setOwnerProfile(profiles[0]);
          }
          const revs = await zimrent.entities.Review.filter({ target_type: "property", target_id: id }, "-created_date", 10);
          setReviews(revs || []);
        }
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [id]);

  const startConversation = async () => {
    if (!user || !listing) return;
    try {
      const existing = await zimrent.entities.Conversation.filter({ property_id: id, listing_id: listing.id });
      const myConvo = (existing || []).find(c => c.data?.participants?.includes(user.id));
      if (myConvo) { navigate(`/messages/${myConvo.id}`); return; }
      const participants = [user.id, listing.created_by_id];
      const convo = await zimrent.entities.Conversation.create({
        participants,
        property_id: id,
        listing_id: listing.id,
        property_title: property?.data?.title,
        last_message_at: new Date().toISOString(),
        last_message_preview: ""
      });
      navigate(`/messages/${convo.id}`);
    } catch (e) { alert(e.message); }
  };

  const requestViewing = async () => {
    if (!viewingForm.requested_date || !viewingForm.requested_time) { alert("Please select a date and time"); return; }
    setSubmitting(true);
    try {
      await zimrent.entities.Viewing.create({
        listing_id: listing.id,
        property_id: id,
        property_title: property?.data?.title,
        tenant_id: user.id,
        owner_id: listing.created_by_id,
        requested_date: viewingForm.requested_date,
        requested_time: viewingForm.requested_time,
        number_of_attendees: viewingForm.number_of_attendees,
        message: viewingForm.message,
        status: "requested"
      });
      await zimrent.entities.Notification.create({
        user_id: listing.created_by_id,
        type: "VIEWING_REQUESTED",
        title: "New viewing request",
        message: `A tenant requested a viewing for "${property?.data?.title}" on ${formatDate(viewingForm.requested_date)} at ${viewingForm.requested_time}.`,
        link: "/owner-dashboard"
      });
      setViewingModal(false);
      setViewingForm({ requested_date: "", requested_time: "", number_of_attendees: 1, message: "" });
      alert("Viewing request sent! The owner will respond soon.");
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  const submitReport = async () => {
    if (!user) { navigate("/login"); return; }
    setReporting(true);
    try {
      await zimrent.entities.Report.create({
        reporter_id: user.id,
        target_type: "property",
        target_id: id,
        reason: reportForm.reason,
        description: reportForm.description,
        status: "open"
      });
      await zimrent.entities.Notification.create({
        user_id: "admin",
        type: "REPORT_SUBMITTED",
        title: "Property reported",
        message: `Property "${property?.data?.title}" was reported for ${reportForm.reason.replace(/_/g, " ")}.`,
        link: "/admin"
      });
      setReportModal(false);
      setReportForm({ reason: "fake_property", description: "" });
      alert("Report submitted. Our team will review it.");
    } catch (e) { alert(e.message); }
    finally { setReporting(false); }
  };

  if (loading) return <LoadingState label="Loading property..." />;
  if (!property) return <EmptyState icon={MapPin} title="Property not found" description="This property may have been removed." action={<Button onClick={() => navigate("/")}>Back to search</Button>} />;

  const d = property.data;
  const photos = d.photos || [];
  const listingData = listing?.data;
  const statusInfo = listing ? LISTING_STATUS[listingData.status] : null;
  const canReserve = listing && listingData.status === "active" && listing.created_by_id !== user?.id;
  const isOwner = listing && listing.created_by_id === user?.id;

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to search
        </Link>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 rounded-2xl overflow-hidden">
          <div className="lg:col-span-2 aspect-[16/10] bg-muted relative">
            {photos[activePhoto] ? (
              <Image src={photos[activePhoto]} alt={d.title} className="w-full h-full" fittingType="fill" />
            ) : (
              <Image src="https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200" alt={d.title} className="w-full h-full" fittingType="fill" />
            )}
          </div>
          <div className="hidden lg:grid grid-rows-2 gap-3">
            {(photos.length > 1 ? photos.slice(1, 3) : ["https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800"]).map((p, i) => (
              <div key={i} className="aspect-[16/10] bg-muted rounded-xl overflow-hidden cursor-pointer" onClick={() => photos.length > 1 && setActivePhoto(i + 1)}>
                <Image src={p} alt="" className="w-full h-full" fittingType="fill" />
              </div>
            ))}
          </div>
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-thin pb-2">
            {photos.map((p, i) => (
              <button key={i} onClick={() => setActivePhoto(i)}
                className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 ${activePhoto === i ? "border-primary" : "border-transparent"}`}>
                <Image src={p} alt="" className="w-full h-full" fittingType="fill" />
              </button>
            ))}
          </div>
        )}

        {/* Video tour */}
        {d.video_url && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Video className="w-5 h-5 text-primary" />
              <h2 className="font-semibold font-heading">Property video tour</h2>
            </div>
            {showVideo ? (
              <div className="aspect-video bg-black rounded-2xl overflow-hidden">
                <video src={d.video_url} controls className="w-full h-full" />
              </div>
            ) : (
              <button onClick={() => setShowVideo(true)} className="relative w-full aspect-video rounded-2xl overflow-hidden group">
                <Image src={photos[0] || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200"} alt="Video tour" className="w-full h-full" fittingType="fill" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                    <Video className="w-7 h-7 text-primary ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 text-white">
                  <p className="font-semibold">Watch property tour</p>
                  <p className="text-xs text-white/80">Walkthrough video available</p>
                </div>
              </button>
            )}
          </div>
        )}

        {d.media_updated_at && (
          <p className="text-xs text-muted-foreground mt-3">Media last updated: {formatDate(d.media_updated_at)}</p>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {statusInfo && <StateBadge status={listingData.status} label={statusInfo.label} color={statusInfo.color} />}
              <PropertyVerificationBadge status={d.verification_status} />
              {isStaleAvailability(listingData?.availability_confirmed_at) && listingData?.status === "active" && (
                <Badge variant="outline" className="text-warning border-warning/30">Availability not recently confirmed</Badge>
              )}
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold font-heading text-balance">{d.title}</h1>
            <p className="text-muted-foreground flex items-center gap-1.5 mt-2">
              <MapPin className="w-4 h-4" /> {d.suburb}, {d.city}{d.area ? `, ${d.area}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-5 mt-4 text-sm">
              <span className="flex items-center gap-1.5"><Bed className="text-muted-foreground" style={{ width: 18, height: 18 }} /> {d.bedrooms} bedrooms</span>
              <span className="flex items-center gap-1.5"><Bath className="text-muted-foreground" style={{ width: 18, height: 18 }} /> {d.bathrooms} bathrooms</span>
              {d.parking_spaces > 0 && <span className="flex items-center gap-1.5"><Car className="text-muted-foreground" style={{ width: 18, height: 18 }} /> {d.parking_spaces} parking</span>}
              <span className="text-muted-foreground">{PROPERTY_TYPES[d.property_type]}</span>
              {d.furnished && <span className="flex items-center gap-1.5"><Sofa className="w-4 h-4 text-muted-foreground" /> Furnished</span>}
            </div>
          </div>

          {listingData?.description && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-semibold font-heading mb-2">About this property</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{listingData.description}</p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold font-heading mb-4">Utilities & amenities</h2>
            <div className="grid grid-cols-2 gap-4">
              <UtilityRow icon={Droplets} label="Water" value={`${WATER_SOURCES[d.water_source] || d.water_source} · ${WATER_RELIABILITY[d.water_reliability] || d.water_reliability}`} />
              <UtilityRow icon={Zap} label="Electricity" value={ELECTRICITY_OPTIONS[d.electricity] || d.electricity} />
              <UtilityRow icon={Battery} label="Backup power" value={BACKUP_POWER[d.backup_power] || d.backup_power} />
              <UtilityRow icon={Wifi} label="Internet" value={d.internet === "available" ? "Available" : d.internet === "not_available" ? "Not available" : "Unknown"} />
              <UtilityRow icon={Trash2} label="Refuse collection" value={d.refuse_collection ? "Yes" : "No"} />
              <UtilityRow icon={Fuel} label="Gas" value={d.gas === "none" ? "None" : d.gas} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold font-heading mb-4">Security features</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Walled", value: d.walled },
                { label: "Gated", value: d.gated },
                { label: "Security guard", value: d.security_guard },
                { label: "CCTV", value: d.cctv },
                { label: "Alarm", value: d.alarm },
                { label: "Secure parking", value: d.secure_parking }
              ].map(f => (
                <div key={f.label} className={`flex items-center gap-2 text-sm ${f.value ? "text-foreground" : "text-muted-foreground/60"}`}>
                  {f.value ? <CheckCircle2 className="w-4 h-4 text-success" /> : <span className="w-4 h-4 rounded-full border border-muted-foreground/30" />}
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold font-heading mb-4">House rules</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <RuleRow label="Pets allowed" value={d.pets_allowed} />
              <RuleRow label="Smoking allowed" value={d.smoking_allowed} />
              <RuleRow label="Visitors allowed" value={d.visitors_allowed} />
              <RuleRow label="Children allowed" value={d.children_allowed} />
              <RuleRow label="Subletting allowed" value={d.subletting_allowed} />
              {d.max_occupancy && <div className="flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" /> Max {d.max_occupancy} occupants</div>}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold font-heading mb-4">Location & nearby</h2>
            <p className="text-sm text-muted-foreground mb-3">Approximate location shown publicly. Exact address shared after a confirmed viewing or reservation.</p>
            {d.approx_lat && d.approx_lng && (
              <div className="rounded-xl overflow-hidden border border-border h-64 bg-muted">
                <iframe
                  title="Approximate location"
                  width="100%" height="100%"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${d.approx_lng - 0.01},${d.approx_lat - 0.01},${d.approx_lng + 0.01},${d.approx_lat + 0.01}&marker=${d.approx_lat},${d.approx_lng}`}
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
              {d.nearby_transport && <NearbyRow label="Transport" value={d.nearby_transport} />}
              {d.nearby_schools && <NearbyRow label="Schools" value={d.nearby_schools} />}
              {d.nearby_shopping && <NearbyRow label="Shopping" value={d.nearby_shopping} />}
              {d.nearby_hospitals && <NearbyRow label="Hospitals" value={d.nearby_hospitals} />}
              {d.nearby_landmarks && <NearbyRow label="Landmarks" value={d.nearby_landmarks} />}
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h2 className="font-semibold font-heading mb-4">Reviews from past tenants</h2>
              <div className="space-y-4">
                {reviews.map(r => (
                  <div key={r.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= r.data.rating ? "fill-accent text-accent" : "text-muted-foreground/30"}`} />)}</div>
                    </div>
                    {r.data.comment && <p className="text-sm text-muted-foreground">{r.data.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 sticky top-20">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-heading text-primary">{formatCurrency(listingData?.monthly_rent, listingData?.currency)}</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>

            <div className="mt-4 space-y-2.5 text-sm">
              <CostRow label="Security deposit" value={formatCurrency(listingData?.security_deposit, listingData?.currency)} />
              <CostRow label="Reservation fee" value={formatCurrency(listingData?.reservation_fee, listingData?.currency)} />
              {listingData?.application_fee > 0 && <CostRow label="Application fee" value={formatCurrency(listingData?.application_fee, listingData?.currency)} />}
              {listingData?.agent_fee > 0 && <CostRow label="Agent fee" value={formatCurrency(listingData?.agent_fee, listingData?.currency)} />}
              <div className="border-t border-border pt-2.5">
                <CostRow label="Estimated move-in cost" value={formatCurrency(listingData?.estimated_move_in_cost || ((listingData?.monthly_rent || 0) + (listingData?.security_deposit || 0)), listingData?.currency)} bold />
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {listingData?.available_from ? `Available from ${formatDate(listingData.available_from)}` : "Available now"}
              </p>
              {listingData?.availability_confirmed_at && (
                <p className="text-xs text-muted-foreground mt-1">Last confirmed: {formatDate(listingData.availability_confirmed_at)}</p>
              )}
            </div>

            {!isOwner && (
              <div className="mt-4 space-y-2">
                {canReserve ? (
                  <Button className="w-full h-12" onClick={() => navigate(`/reserve/${listing.id}`)}>
                    <Lock className="w-4 h-4 mr-2" /> Reserve for {formatCurrency(listingData?.reservation_fee, listingData?.currency)}
                  </Button>
                ) : listingData?.status !== "active" ? (
                  <div className="p-3 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                    This property is currently {statusInfo?.label.toLowerCase()}
                  </div>
                ) : null}
                <Button variant="outline" className="w-full h-11" onClick={startConversation}>
                  <MessageSquare className="w-4 h-4 mr-2" /> Message owner
                </Button>
                <Dialog open={viewingModal} onOpenChange={setViewingModal}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full h-11">
                      <Calendar className="w-4 h-4 mr-2" /> Request viewing
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request a viewing</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="date">Preferred date</Label>
                          <Input id="date" type="date" value={viewingForm.requested_date} onChange={(e) => setViewingForm({ ...viewingForm, requested_date: e.target.value })} className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="time">Preferred time</Label>
                          <Input id="time" type="time" value={viewingForm.requested_time} onChange={(e) => setViewingForm({ ...viewingForm, requested_time: e.target.value })} className="mt-1.5" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="attendees">Number of attendees</Label>
                        <Input id="attendees" type="number" min="1" max="10" value={viewingForm.number_of_attendees} onChange={(e) => setViewingForm({ ...viewingForm, number_of_attendees: Number(e.target.value) })} className="mt-1.5" />
                      </div>
                      <div>
                        <Label htmlFor="msg">Message (optional)</Label>
                        <Textarea id="msg" value={viewingForm.message} onChange={(e) => setViewingForm({ ...viewingForm, message: e.target.value })} placeholder="Any questions for the owner?" className="mt-1.5" rows={3} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setViewingModal(false)}>Cancel</Button>
                      <Button onClick={requestViewing} disabled={submitting}>{submitting ? "Sending..." : "Send request"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {isOwner && (
              <div className="mt-4 p-3 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                This is your listing
              </div>
            )}

            {ownerProfile && (
              <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Listed by</p>
                <Link to={`/profile/${ownerProfile.id}`} className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 -m-2 transition-colors">
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {ownerProfile.data?.full_name?.split(" ").map(s => s[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{ownerProfile.data?.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ownerProfile.data?.role}</p>
                  </div>
                </Link>
                <div className="mt-3 space-y-2">
                  <IdentityBadge status={ownerProfile.data?.identity_status} />
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {ownerProfile.data?.completed_rentals > 0 && <span>{ownerProfile.data.completed_rentals} rentals</span>}
                    {ownerProfile.data?.rating > 0 && (
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-accent text-accent" /> {ownerProfile.data.rating}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Trust panel */}
            <div className="mt-5 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">ZimRent Trust</p>
              </div>
              <div className="space-y-2 text-sm">
                <TrustItem label="Identity verified" done={ownerProfile?.data?.identity_status === "identity_verified"} />
                <TrustItem label="Property verified" done={d.verification_status === "verified"} pending={d.verification_status === "pending"} />
                <TrustItem label="Listing authority verified" done={d.authority_status === "verified"} pending={d.authority_status === "pending"} />
                <TrustItem label="Phone verified" done={ownerProfile?.data?.phone_verified} />
              </div>
            </div>

            {/* Safety warning */}
            <div className="mt-3 p-3 bg-warning/5 border border-warning/20 rounded-lg flex gap-2">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                For your protection, complete all rental payments through the platform. Payments made outside the platform may not be covered by platform protections.
              </p>
            </div>

            {/* Report listing */}
            {!isOwner && (
              <button onClick={() => setReportModal(true)} className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-destructive py-2 transition-colors">
                <Flag className="w-3.5 h-3.5" /> Report this listing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Report dialog */}
      <Dialog open={reportModal} onOpenChange={setReportModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason for reporting</Label>
              <Select value={reportForm.reason} onValueChange={(v) => setReportForm({ ...reportForm, reason: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fake_property">Fake property</SelectItem>
                  <SelectItem value="misleading_photos">Misleading photos</SelectItem>
                  <SelectItem value="incorrect_price">Incorrect price</SelectItem>
                  <SelectItem value="incorrect_location">Incorrect location</SelectItem>
                  <SelectItem value="suspicious_landlord">Suspicious landlord/agent</SelectItem>
                  <SelectItem value="fraud_attempt">Fraud attempt</SelectItem>
                  <SelectItem value="safety_concern">Safety concern</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rdesc">Description</Label>
              <Textarea id="rdesc" value={reportForm.description} onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} className="mt-1.5" rows={4} placeholder="Provide details about your concern" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportModal(false)}>Cancel</Button>
            <Button onClick={submitReport} disabled={reporting}>
              {reporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4 mr-2" /> Submit report</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrustItem({ label, done, pending }) {
  return (
    <div className="flex items-center gap-2">
      {done ? <CheckCircle2 className="w-4 h-4 text-success" /> : pending ? <Loader2 className="w-4 h-4 text-warning animate-spin" /> : <span className="w-4 h-4 rounded-full border border-muted-foreground/30" />}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function UtilityRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium capitalize">{value}</p>
      </div>
    </div>
  );
}

function RuleRow({ label, value }) {
  return (
    <div className={`flex items-center gap-2 ${value ? "text-foreground" : "text-muted-foreground/60"}`}>
      {value ? <CheckCircle2 className="w-4 h-4 text-success" /> : <span className="w-4 h-4 rounded-full border border-muted-foreground/30" />}
      {label}
    </div>
  );
}

function NearbyRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function CostRow({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}