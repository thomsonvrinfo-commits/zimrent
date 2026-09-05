import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User, Phone, MapPin, ShieldCheck, Star, Home, Loader2, CheckCircle2,
  Building2, Users, ArrowRight, AlertCircle, Briefcase, Wallet, Heart
} from "lucide-react";
import { IdentityBadge } from "@/components/VerificationBadge";
import { LoadingState } from "@/components/EmptyState";
import { formatDate, formatCurrency } from "@/lib/rental-utils";

const CITIES = ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru", "Kwekwe", "Kadoma", "Masvingo"];

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile: myProfile, loading, refresh } = useProfile();
  const [viewingProfile, setViewingProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  const isOwnProfile = !id || (myProfile && id === myProfile.id);

  useEffect(() => {
    if (!isOwnProfile && id) {
      (async () => {
        try {
          const p = await zimrent.entities.Profile.get(id);
          setViewingProfile(p);
        } catch (e) {}
      })();
    }
  }, [id, isOwnProfile]);

  useEffect(() => {
    if (myProfile) {
      setForm({
        full_name: myProfile.data?.full_name || user?.full_name || "",
        role: myProfile.data?.role || "tenant",
        phone: myProfile.data?.phone || "",
        city: myProfile.data?.city || "",
        bio: myProfile.data?.bio || "",
        employment_status: myProfile.data?.employment_status || "",
        income_range: myProfile.data?.income_range || "",
        household_size: myProfile.data?.household_size || 1,
        preferred_locations: myProfile.data?.preferred_locations || "",
        budget: myProfile.data?.budget || "",
        desired_property_type: myProfile.data?.desired_property_type || "any",
        desired_bedrooms: myProfile.data?.desired_bedrooms || 0,
        furnished_preference: myProfile.data?.furnished_preference || "any",
        desired_move_in_date: myProfile.data?.desired_move_in_date || ""
      });
    } else if (!loading) {
      setForm({
        full_name: user?.full_name || "",
        role: "tenant",
        phone: "",
        city: "",
        bio: "",
        employment_status: "",
        income_range: "",
        household_size: 1,
        preferred_locations: "",
        budget: "",
        desired_property_type: "any",
        desired_bedrooms: 0,
        furnished_preference: "any",
        desired_move_in_date: ""
      });
    }
  }, [myProfile, loading, user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const profileData = {
        full_name: form.full_name,
        phone: form.phone,
        city: form.city,
        bio: form.bio,
        employment_status: form.employment_status,
        income_range: form.income_range,
        household_size: Number(form.household_size) || 1,
        preferred_locations: form.preferred_locations,
        budget: form.budget ? Number(form.budget) : null,
        desired_property_type: form.desired_property_type,
        desired_bedrooms: Number(form.desired_bedrooms) || 0,
        furnished_preference: form.furnished_preference,
        desired_move_in_date: form.desired_move_in_date
      };
      if (myProfile) {
        await zimrent.entities.Profile.update(myProfile.id, profileData);
      } else {
        await zimrent.entities.Profile.create({
          ...profileData,
          role: form.role,
          phone_verified: false,
          identity_status: "unverified",
          authority_status: "unverified",
          completed_rentals: 0,
          rating: 0,
          review_count: 0
        });
      }
      await refresh();
      setEditing(false);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const verifyPhone = async () => {
    setVerifyingPhone(true);
    try {
      // Mock phone verification — in production this would send an OTP via SMS
      // through a NotificationService adapter. Here we mark as verified.
      await zimrent.entities.Profile.update(myProfile.id, {
        phone_verified: true,
        identity_status: myProfile.data?.identity_status === "unverified" ? "phone_verified" : myProfile.data?.identity_status
      });
      await refresh();
    } catch (e) { alert(e.message); }
    finally { setVerifyingPhone(false); }
  };

  const submitIdentityVerification = async () => {
    try {
      // Mock identity verification submission — in production this would submit
      // documents to an IdentityService adapter (KYC provider). Here we mark
      // as pending for admin review.
      await zimrent.entities.Profile.update(myProfile.id, {
        identity_status: "identity_pending",
        identity_reference: "manual_review_" + Date.now()
      });
      await zimrent.entities.Notification.create({
        user_id: "admin",
        type: "IDENTITY_VERIFICATION_REQUEST",
        title: "Identity verification request",
        message: `${myProfile.data?.full_name} requested identity verification.`,
        link: "/admin"
      });
      await refresh();
      alert("Your identity verification request has been submitted for review.");
    } catch (e) { alert(e.message); }
  };

  const submitAuthorityVerification = async () => {
    try {
      // Mock authority verification — in production this would submit
      // ownership/agent authority evidence for admin review.
      await zimrent.entities.Profile.update(myProfile.id, {
        authority_status: "pending",
        authority_reference: "authority_review_" + Date.now()
      });
      await zimrent.entities.Notification.create({
        user_id: "admin",
        type: "AUTHORITY_VERIFICATION_REQUEST",
        title: "Authority verification request",
        message: `${myProfile.data?.full_name} requested authority verification as ${myProfile.data?.role}.`,
        link: "/admin"
      });
      await refresh();
      alert("Your authority verification request has been submitted for review.");
    } catch (e) { alert(e.message); }
  };

  if (loading) return <LoadingState label="Loading profile..." />;

  // Viewing another user's profile (public trust view)
  if (!isOwnProfile) {
    const p = viewingProfile?.data;
    if (!p) return <LoadingState label="Loading profile..." />;
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
              {p.full_name?.split(" ").map(s => s[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h1 className="text-xl font-bold font-heading">{p.full_name}</h1>
              <p className="text-sm text-muted-foreground capitalize">{p.role}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <IdentityBadge status={p.identity_status} />
            {p.city && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {p.city}</p>}
            {p.bio && <p className="text-sm text-muted-foreground mt-3">{p.bio}</p>}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
              <Stat label="Rentals" value={p.completed_rentals || 0} />
              <Stat label="Rating" value={p.rating > 0 ? p.rating : "—"} />
              <Stat label="Response" value={p.response_rate > 0 ? `${p.response_rate}%` : "—"} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Own profile — onboarding or edit
  const showOnboarding = !myProfile && !editing;
  const profileData = myProfile?.data;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {showOnboarding ? (
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-heading">Welcome to Dzimba</h1>
          <p className="text-muted-foreground mt-2">Tell us a bit about yourself to get started.</p>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-heading">My Profile</h1>
          {!editing && <Button variant="outline" onClick={() => setEditing(true)}>Edit profile</Button>}
        </div>
      )}

      {editing || showOnboarding ? (
        <Card className="border-border">
          <CardContent className="p-6 space-y-5">
            {showOnboarding && (
              <div>
                <Label className="text-base font-semibold">I want to...</Label>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {[
                    { value: "tenant", label: "Find a place to rent", icon: Home },
                    { value: "owner", label: "List my properties", icon: Building2 }
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setForm({ ...form, role: opt.value })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${form.role === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      <opt.icon className={`w-5 h-5 mb-2 ${form.role === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="text-sm font-medium">{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form?.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1.5" placeholder="Your full name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" value={form?.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5" placeholder="077xxxxxxx" />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Select value={form?.city || ""} onValueChange={(v) => setForm({ ...form, city: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>
                    {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="bio">About you (optional)</Label>
              <Textarea id="bio" value={form?.bio || ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-1.5" rows={3} placeholder="A brief introduction for landlords or tenants" />
            </div>

            {/* Rental preferences (tenant only) */}
            {form?.role === "tenant" && (
              <div className="pt-4 border-t border-border space-y-4">
                <p className="font-semibold text-sm flex items-center gap-2"><Heart className="w-4 h-4 text-primary" /> Rental preferences</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emp">Employment status</Label>
                    <Input id="emp" value={form?.employment_status || ""} onChange={(e) => setForm({ ...form, employment_status: e.target.value })} className="mt-1.5" placeholder="e.g. Employed, Self-employed" />
                  </div>
                  <div>
                    <Label htmlFor="income">Income range (USD/month)</Label>
                    <Select value={form?.income_range || ""} onValueChange={(v) => setForm({ ...form, income_range: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select range" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-500">Below $500</SelectItem>
                        <SelectItem value="500-1000">$500 - $1,000</SelectItem>
                        <SelectItem value="1000-2000">$1,000 - $2,000</SelectItem>
                        <SelectItem value="2000+">Above $2,000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="hh">Household size</Label>
                    <Input id="hh" type="number" min="1" max="20" value={form?.household_size || 1} onChange={(e) => setForm({ ...form, household_size: e.target.value })} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="budget">Monthly budget (USD)</Label>
                    <Input id="budget" type="number" min="0" value={form?.budget || ""} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="mt-1.5" placeholder="e.g. 500" />
                  </div>
                  <div>
                    <Label htmlFor="locs">Preferred locations</Label>
                    <Input id="locs" value={form?.preferred_locations || ""} onChange={(e) => setForm({ ...form, preferred_locations: e.target.value })} className="mt-1.5" placeholder="e.g. Avondale, Borrowdale" />
                  </div>
                  <div>
                    <Label htmlFor="dtype">Property type</Label>
                    <Select value={form?.desired_property_type || "any"} onValueChange={(v) => setForm({ ...form, desired_property_type: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="room">Room</SelectItem>
                        <SelectItem value="bedsitter">Bedsitter</SelectItem>
                        <SelectItem value="cottage">Cottage</SelectItem>
                        <SelectItem value="apartment">Apartment</SelectItem>
                        <SelectItem value="1bedroom">1 Bedroom</SelectItem>
                        <SelectItem value="2bedroom">2 Bedroom</SelectItem>
                        <SelectItem value="3bedroom">3 Bedroom</SelectItem>
                        <SelectItem value="house">House</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="beds">Min bedrooms</Label>
                    <Select value={String(form?.desired_bedrooms || 0)} onValueChange={(v) => setForm({ ...form, desired_bedrooms: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Any</SelectItem>
                        <SelectItem value="1">1+</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                        <SelectItem value="4">4+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="furn">Furnished preference</Label>
                    <Select value={form?.furnished_preference || "any"} onValueChange={(v) => setForm({ ...form, furnished_preference: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="furnished">Furnished</SelectItem>
                        <SelectItem value="unfurnished">Unfurnished</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="movein">Desired move-in date</Label>
                    <Input id="movein" type="date" value={form?.desired_move_in_date || ""} onChange={(e) => setForm({ ...form, desired_move_in_date: e.target.value })} className="mt-1.5" />
                  </div>
                </div>
              </div>
            )}
            <Button onClick={handleSave} disabled={saving} className="w-full h-12">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <>{showOnboarding ? "Create profile" : "Save changes"} <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Profile header */}
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                  {profileData?.full_name?.split(" ").map(s => s[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold font-heading">{profileData?.full_name}</h2>
                  <p className="text-sm text-muted-foreground capitalize">{profileData?.role}</p>
                </div>
                <IdentityBadge status={profileData?.identity_status} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-border text-sm">
                {profileData?.phone && <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {profileData.phone}</p></div>}
                {profileData?.city && <div><p className="text-xs text-muted-foreground">City</p><p className="font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {profileData.city}</p></div>}
              </div>
              {profileData?.bio && <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border">{profileData.bio}</p>}
            </CardContent>
          </Card>

          {/* Verification center */}
          <Card className="border-border">
            <CardHeader><CardTitle className="text-base">Verification center</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <VerificationItem
                label="Phone verification"
                done={profileData?.phone_verified}
                action={!profileData?.phone_verified && profileData?.phone ? { label: "Verify phone", onClick: verifyPhone, loading: verifyingPhone } : null}
                description={profileData?.phone_verified ? "Your phone number has been verified." : "Verify your phone number to build trust."}
              />
              <VerificationItem
                label="Email verification"
                done={true}
                description="Your email is verified through the platform authentication system."
              />
              <VerificationItem
                label="Identity verification"
                done={profileData?.identity_status === "identity_verified"}
                pending={profileData?.identity_status === "identity_pending" || profileData?.identity_status === "verification_review"}
                action={profileData?.identity_status === "unverified" || profileData?.identity_status === "phone_verified" ? { label: "Submit for verification", onClick: submitIdentityVerification } : null}
                description={
                  profileData?.identity_status === "identity_verified" ? "Your identity has been verified by our verification process." :
                  profileData?.identity_status === "identity_pending" ? "Your verification is under review. We'll notify you when it's complete." :
                  profileData?.identity_status === "verification_failed" ? "Verification could not be completed. Please try again or contact support." :
                  "Verify your identity to build trust with landlords and tenants."
                }
              />
              {(profileData?.role === "owner" || profileData?.role === "agent") && (
                <VerificationItem
                  label="Authority verification"
                  done={profileData?.authority_status === "verified"}
                  pending={profileData?.authority_status === "pending"}
                  action={profileData?.authority_status === "unverified" ? { label: "Submit authority evidence", onClick: submitAuthorityVerification } : null}
                  description={
                    profileData?.authority_status === "verified" ? "Your authority to list properties has been verified." :
                    profileData?.authority_status === "pending" ? "Your authority evidence is under review." :
                    "Verify your ownership or agent authority to list properties."
                  }
                />
              )}
              <div className="pt-3 border-t border-border text-xs text-muted-foreground flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>Identity verification confirms a person's identity has been checked. Authority verification confirms they are authorised to list a specific property. A verified identity alone does not make someone eligible to collect payments.</p>
              </div>
            </CardContent>
          </Card>

          {/* Rental preferences (tenant) */}
          {profileData?.role === "tenant" && (profileData?.employment_status || profileData?.budget || profileData?.preferred_locations) && (
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Rental preferences</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {profileData?.employment_status && <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="w-3 h-3" /> Employment</p><p className="font-medium">{profileData.employment_status}</p></div>}
                  {profileData?.income_range && <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" /> Income range</p><p className="font-medium">{profileData.income_range}</p></div>}
                  {profileData?.household_size > 0 && <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Household</p><p className="font-medium">{profileData.household_size} person(s)</p></div>}
                  {profileData?.budget > 0 && <div><p className="text-xs text-muted-foreground">Budget</p><p className="font-medium">{formatCurrency(profileData.budget, "USD")}/month</p></div>}
                  {profileData?.preferred_locations && <div><p className="text-xs text-muted-foreground">Preferred locations</p><p className="font-medium">{profileData.preferred_locations}</p></div>}
                  {profileData?.desired_property_type && profileData?.desired_property_type !== "any" && <div><p className="text-xs text-muted-foreground">Property type</p><p className="font-medium capitalize">{profileData.desired_property_type}</p></div>}
                  {profileData?.desired_bedrooms > 0 && <div><p className="text-xs text-muted-foreground">Min bedrooms</p><p className="font-medium">{profileData.desired_bedrooms}+</p></div>}
                  {profileData?.desired_move_in_date && <div><p className="text-xs text-muted-foreground">Move-in date</p><p className="font-medium">{formatDate(profileData.desired_move_in_date)}</p></div>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trust stats */}
          <Card className="border-border">
            <CardHeader><CardTitle className="text-base">Reputation</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 text-center">
                <Stat label="Rentals" value={profileData?.completed_rentals || 0} />
                <Stat label="Rating" value={profileData?.rating > 0 ? <span className="flex items-center justify-center gap-1"><Star className="w-3.5 h-3.5 fill-accent text-accent" />{profileData.rating}</span> : "—"} />
                <Stat label="Reviews" value={profileData?.review_count || 0} />
                <Stat label="Response" value={profileData?.response_rate > 0 ? `${profileData.response_rate}%` : "—"} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function VerificationItem({ label, done, pending, action, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-success/10" : pending ? "bg-warning/10" : "bg-muted"}`}>
        {done ? <CheckCircle2 className="w-4.5 h-4.5 text-success" style={{ width: 18, height: 18 }} /> : pending ? <Loader2 className="w-4 h-4 text-warning animate-spin" /> : <ShieldCheck className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        {action && (
          <Button size="sm" variant="outline" className="mt-2 h-8 text-xs" onClick={action.onClick} disabled={action.loading}>
            {action.loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-lg font-bold font-heading">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}