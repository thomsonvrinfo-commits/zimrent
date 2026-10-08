import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  User,
  Phone,
  MapPin,
  ShieldCheck,
  Home,
  Loader2,
  CheckCircle2,
  Building2,
  Users,
  ArrowRight,
  AlertCircle,
  Briefcase,
  Wallet,
  Heart
} from "lucide-react";
import { IdentityBadge } from "@/components/VerificationBadge";
import { LoadingState } from "@/components/EmptyState";
import { formatDate, formatCurrency } from "@/lib/rental-utils";

const CITIES = [
  "Harare",
  "Bulawayo",
  "Chitungwiza",
  "Mutare",
  "Gweru",
  "Kwekwe",
  "Kadoma",
  "Masvingo"
];

const DEFAULT_PREFERENCES = {
  city: "",
  employment_status: "",
  income_range: "",
  household_size: 1,
  preferred_locations: "",
  budget: "",
  desired_property_type: "any",
  desired_bedrooms: 0,
  furnished_preference: "any",
  desired_move_in_date: ""
};

function parsePreferences(profile) {
  const raw = profile?.data?.preferences_json;

  if (!raw) {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

    return {
      ...DEFAULT_PREFERENCES,
      ...(parsed && typeof parsed === "object" ? parsed : {})
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function getDisplayName(profile, user) {
  return (
    profile?.data?.display_name ||
    user?.display_name ||
    user?.email ||
    ""
  );
}

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();

  const {
    profile: myProfile,
    loading,
    refresh,
    capabilities
  } = useProfile();

  const [viewingProfile, setViewingProfile] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [togglingCapability, setTogglingCapability] = useState(null);

  const toggleCapability = async (capability, isEnabled) => {
    if (isEnabled && capabilities.length === 1) {
      alert("You need at least one ZimRent capability enabled.");
      return;
    }

    setTogglingCapability(capability);

    try {
      if (isEnabled) {
        await zimrent.capabilities.revoke(capability);
      } else {
        await zimrent.capabilities.grant(capability);
      }

      await refresh();
    } catch (e) {
      alert(e.message || "Failed to update capability.");
    } finally {
      setTogglingCapability(null);
    }
  };

  const isOwnProfile =
    !id ||
    (myProfile &&
      (id === myProfile.id || id === myProfile.created_by_id));

  useEffect(() => {
    if (isOwnProfile || !id) return;

    let active = true;

    (async () => {
      setViewingLoading(true);

      try {
        const profile = await zimrent.profiles.getPublic(id);

        if (active) {
          setViewingProfile(profile);
        }
      } catch {
        if (active) {
          setViewingProfile(null);
        }
      } finally {
        if (active) {
          setViewingLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [id, isOwnProfile]);

  useEffect(() => {
    if (myProfile) {
      const preferences = parsePreferences(myProfile);

      setForm({
        full_name: getDisplayName(myProfile, user),
        capabilities: myProfile.capabilities || [],
        phone: myProfile.data?.phone || "",
        bio: myProfile.data?.bio || "",
        ...preferences
      });

      return;
    }

    if (!loading) {
      setForm({
        full_name: getDisplayName(null, user),
        capabilities: [],
        phone: "",
        bio: "",
        ...DEFAULT_PREFERENCES
      });
    }
  }, [myProfile, loading, user]);

  const updateForm = (changes) => {
    setForm((current) => ({
      ...(current || {}),
      ...changes
    }));
  };

  const handleSave = async () => {
    if (!form) return;

    const selectedCapabilities = [
      ...new Set(form.capabilities || [])
    ];

    if (!myProfile && selectedCapabilities.length === 0) {
      alert("Choose at least one way to use ZimRent.");
      return;
    }

    setSaving(true);

    try {
      const preferences = {
        city: form.city || "",
        employment_status: form.employment_status || "",
        income_range: form.income_range || "",
        household_size: Number(form.household_size) || 1,
        preferred_locations: form.preferred_locations || "",
        budget: form.budget ? Number(form.budget) : null,
        desired_property_type: form.desired_property_type || "any",
        desired_bedrooms: Number(form.desired_bedrooms) || 0,
        furnished_preference: form.furnished_preference || "any",
        desired_move_in_date: form.desired_move_in_date || ""
      };

      const profileData = {
        display_name: form.full_name?.trim() || "",
        phone: form.phone?.trim() || "",
        bio: form.bio?.trim() || "",
        preferences_json: JSON.stringify(preferences)
      };

      if (myProfile) {
        await zimrent.profiles.update(profileData);
      } else {
        await zimrent.profiles.createIfMissing(profileData);

        for (const capability of selectedCapabilities) {
          await zimrent.capabilities.grant(capability);
        }
      }

      await refresh();
      setEditing(false);
    } catch (e) {
      alert(e.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading profile..." />;
  }

  if (!isOwnProfile) {
    if (viewingLoading) {
      return <LoadingState label="Loading profile..." />;
    }

    const p = viewingProfile?.data;

    if (!p) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card className="border-border">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Profile unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">
                This profile could not be found.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    const publicName = p.display_name || "ZimRent user";

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                {publicName
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>

              <div>
                <h1 className="text-xl font-bold font-heading">
                  {publicName}
                </h1>

                <IdentityBadge status={p.identity_status} />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {p.bio && (
                <p className="text-sm text-muted-foreground">
                  {p.bio}
                </p>
              )}

              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                <Stat label="Rentals" value="—" />
                <Stat label="Rating" value="—" />
                <Stat label="Response" value="—" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showOnboarding = !myProfile && !editing;
  const profileData = myProfile?.data;

  const identityVerification =
    myProfile?.verification?.identity || null;

  const identityStatus =
    identityVerification?.status ||
    profileData?.identity_status ||
    "unverified";

  const isIdentityVerified =
    identityStatus === "verified" ||
    identityStatus === "identity_verified";

  const isIdentityPending =
    identityStatus === "pending" ||
    identityStatus === "identity_pending" ||
    identityStatus === "verification_review";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {showOnboarding ? (
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>

          <h1 className="text-2xl font-bold font-heading">
            Welcome to ZimRent
          </h1>

          <p className="text-muted-foreground mt-2">
            Tell us a bit about yourself to get started.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold font-heading">
            My Profile
          </h1>

          {!editing && (
            <Button
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Edit profile
            </Button>
          )}
        </div>
      )}

      {editing || showOnboarding ? (
        <Card className="border-border">
          <CardContent className="p-6 space-y-5">
            {showOnboarding && (
              <div>
                <Label className="text-base font-semibold">
                  How will you use ZimRent?
                </Label>

                <p className="text-sm text-muted-foreground mt-1">
                  You can choose one or both.
                </p>

                <div className="space-y-3 mt-3">
                  <CapabilityChoice
                    selected={form?.capabilities?.includes("renting")}
                    icon={Home}
                    title="Renting"
                    description="Find and rent a home"
                    onClick={() =>
                      updateForm({
                        capabilities: form?.capabilities?.includes("renting")
                          ? form.capabilities.filter(
                              (c) => c !== "renting"
                            )
                          : [
                              ...(form?.capabilities || []),
                              "renting"
                            ]
                      })
                    }
                  />

                  <CapabilityChoice
                    selected={form?.capabilities?.includes("listing")}
                    icon={Building2}
                    title="Listing properties"
                    description="List and manage your properties"
                    onClick={() =>
                      updateForm({
                        capabilities: form?.capabilities?.includes("listing")
                          ? form.capabilities.filter(
                              (c) => c !== "listing"
                            )
                          : [
                              ...(form?.capabilities || []),
                              "listing"
                            ]
                      })
                    }
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="name">Full name</Label>

              <Input
                id="name"
                value={form?.full_name || ""}
                onChange={(e) =>
                  updateForm({ full_name: e.target.value })
                }
                className="mt-1.5"
                placeholder="Your full name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone number</Label>

                <Input
                  id="phone"
                  value={form?.phone || ""}
                  onChange={(e) =>
                    updateForm({ phone: e.target.value })
                  }
                  className="mt-1.5"
                  placeholder="077xxxxxxx"
                />
              </div>

              <div>
                <Label htmlFor="city">City</Label>

                <Select
                  value={form?.city || ""}
                  onValueChange={(value) =>
                    updateForm({ city: value })
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>

                  <SelectContent>
                    {CITIES.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="bio">About you (optional)</Label>

              <Textarea
                id="bio"
                value={form?.bio || ""}
                onChange={(e) =>
                  updateForm({ bio: e.target.value })
                }
                className="mt-1.5"
                rows={3}
                placeholder="A brief introduction for landlords or tenants"
              />
            </div>

            {form?.capabilities?.includes("renting") && (
              <div className="pt-4 border-t border-border space-y-4">
                <p className="font-semibold text-sm flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" />
                  Rental preferences
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emp">
                      Employment status
                    </Label>

                    <Input
                      id="emp"
                      value={form?.employment_status || ""}
                      onChange={(e) =>
                        updateForm({
                          employment_status: e.target.value
                        })
                      }
                      className="mt-1.5"
                      placeholder="e.g. Employed, Self-employed"
                    />
                  </div>

                  <div>
                    <Label htmlFor="income">
                      Income range (USD/month)
                    </Label>

                    <Select
                      value={form?.income_range || ""}
                      onValueChange={(value) =>
                        updateForm({ income_range: value })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="0-500">
                          Below $500
                        </SelectItem>
                        <SelectItem value="500-1000">
                          $500 - $1,000
                        </SelectItem>
                        <SelectItem value="1000-2000">
                          $1,000 - $2,000
                        </SelectItem>
                        <SelectItem value="2000+">
                          Above $2,000
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="hh">
                      Household size
                    </Label>

                    <Input
                      id="hh"
                      type="number"
                      min="1"
                      max="20"
                      value={form?.household_size || 1}
                      onChange={(e) =>
                        updateForm({
                          household_size: e.target.value
                        })
                      }
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="budget">
                      Monthly budget (USD)
                    </Label>

                    <Input
                      id="budget"
                      type="number"
                      min="0"
                      value={form?.budget || ""}
                      onChange={(e) =>
                        updateForm({
                          budget: e.target.value
                        })
                      }
                      className="mt-1.5"
                      placeholder="e.g. 500"
                    />
                  </div>

                  <div>
                    <Label htmlFor="locs">
                      Preferred locations
                    </Label>

                    <Input
                      id="locs"
                      value={form?.preferred_locations || ""}
                      onChange={(e) =>
                        updateForm({
                          preferred_locations: e.target.value
                        })
                      }
                      className="mt-1.5"
                      placeholder="e.g. Avondale, Borrowdale"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dtype">
                      Property type
                    </Label>

                    <Select
                      value={
                        form?.desired_property_type || "any"
                      }
                      onValueChange={(value) =>
                        updateForm({
                          desired_property_type: value
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="any">
                          Any
                        </SelectItem>
                        <SelectItem value="room">
                          Room
                        </SelectItem>
                        <SelectItem value="bedsitter">
                          Bedsitter
                        </SelectItem>
                        <SelectItem value="cottage">
                          Cottage
                        </SelectItem>
                        <SelectItem value="apartment">
                          Apartment
                        </SelectItem>
                        <SelectItem value="1bedroom">
                          1 Bedroom
                        </SelectItem>
                        <SelectItem value="2bedroom">
                          2 Bedroom
                        </SelectItem>
                        <SelectItem value="3bedroom">
                          3 Bedroom
                        </SelectItem>
                        <SelectItem value="house">
                          House
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="beds">
                      Min bedrooms
                    </Label>

                    <Select
                      value={String(
                        form?.desired_bedrooms || 0
                      )}
                      onValueChange={(value) =>
                        updateForm({
                          desired_bedrooms: value
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="0">
                          Any
                        </SelectItem>
                        <SelectItem value="1">
                          1+
                        </SelectItem>
                        <SelectItem value="2">
                          2+
                        </SelectItem>
                        <SelectItem value="3">
                          3+
                        </SelectItem>
                        <SelectItem value="4">
                          4+
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="furn">
                      Furnished preference
                    </Label>

                    <Select
                      value={
                        form?.furnished_preference || "any"
                      }
                      onValueChange={(value) =>
                        updateForm({
                          furnished_preference: value
                        })
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="any">
                          Any
                        </SelectItem>
                        <SelectItem value="furnished">
                          Furnished
                        </SelectItem>
                        <SelectItem value="unfurnished">
                          Unfurnished
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="movein">
                      Desired move-in date
                    </Label>

                    <Input
                      id="movein"
                      type="date"
                      value={
                        form?.desired_move_in_date || ""
                      }
                      onChange={(e) =>
                        updateForm({
                          desired_move_in_date:
                            e.target.value
                        })
                      }
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || !form}
              className="w-full h-12"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {showOnboarding
                    ? "Create profile"
                    : "Save changes"}

                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
                  {(profileData?.display_name || "")
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>

                <div className="flex-1">
                  <h2 className="text-lg font-bold font-heading">
                    {profileData?.display_name ||
                      user?.display_name ||
                      "ZimRent user"}
                  </h2>

                  <div className="flex flex-wrap gap-2 mt-1">
                    {capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium"
                      >
                        {capability === "listing"
                          ? "Listing properties"
                          : "Renting"}
                      </span>
                    ))}
                  </div>
                </div>

                <IdentityBadge status={identityStatus} />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-border text-sm">
                {profileData?.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Phone
                    </p>

                    <p className="font-medium flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {profileData.phone}
                    </p>
                  </div>
                )}

                {parsePreferences(myProfile).city && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      City
                    </p>

                    <p className="font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {parsePreferences(myProfile).city}
                    </p>
                  </div>
                )}
              </div>

              {profileData?.bio && (
                <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border">
                  {profileData.bio}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">
                What you do on ZimRent
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <CapabilitySwitch
                title="Renting"
                description="Search, save properties, message listers, apply"
                checked={capabilities.includes("renting")}
                disabled={togglingCapability === "renting"}
                onCheckedChange={() =>
                  toggleCapability(
                    "renting",
                    capabilities.includes("renting")
                  )
                }
              />

              <CapabilitySwitch
                title="Listing properties"
                description="Create properties, manage listings, receive enquiries"
                checked={capabilities.includes("listing")}
                disabled={togglingCapability === "listing"}
                onCheckedChange={() =>
                  toggleCapability(
                    "listing",
                    capabilities.includes("listing")
                  )
                }
                bordered
              />

              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                Turning on "Listing properties" does not authorize you to list
                any specific property. Each property requires its own authority
                verification before you can publish a listing.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">
                Verification center
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <VerificationItem
                label="Phone number"
                done={Boolean(profileData?.phone)}
                description={
                  profileData?.phone
                    ? "A phone number is associated with your profile. Phone OTP verification will be added separately."
                    : "Add a phone number to your profile."
                }
              />

              <VerificationItem
                label="Email verification"
                done={Boolean(user?.email_verified)}
                description={
                  user?.email_verified
                    ? "Your email is verified through platform authentication."
                    : "Verify your email through platform authentication."
                }
              />

              <VerificationItem
                label="Identity verification"
                done={isIdentityVerified}
                pending={isIdentityPending}
                description={
                  isIdentityVerified
                    ? "Your identity has been verified."
                    : isIdentityPending
                    ? "Your identity verification is under review."
                    : "Identity verification will be available through the verification process."
                }
              />

              {capabilities.includes("listing") && (
                <VerificationItem
                  label="Property authority"
                  description="Authority is verified separately for each property. A listing capability alone does not prove ownership or authorization."
                />
              )}

              <div className="pt-3 border-t border-border text-xs text-muted-foreground flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />

                <p>
                  Identity verification confirms a person's identity has been
                  checked. Property authority verification confirms that a user
                  is authorized to manage a specific property.
                </p>
              </div>
            </CardContent>
          </Card>

          {capabilities.includes("renting") &&
            (() => {
              const preferences = parsePreferences(myProfile);

              return (
                (preferences.employment_status ||
                  preferences.budget ||
                  preferences.preferred_locations) && (
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="text-base">
                        Rental preferences
                      </CardTitle>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {preferences.employment_status && (
                          <Preference
                            icon={Briefcase}
                            label="Employment"
                            value={preferences.employment_status}
                          />
                        )}

                        {preferences.income_range && (
                          <Preference
                            icon={Wallet}
                            label="Income range"
                            value={preferences.income_range}
                          />
                        )}

                        {preferences.household_size > 0 && (
                          <Preference
                            icon={Users}
                            label="Household"
                            value={`${preferences.household_size} person(s)`}
                          />
                        )}

                        {preferences.budget > 0 && (
                          <Preference
                            label="Budget"
                            value={`${formatCurrency(
                              preferences.budget,
                              "USD"
                            )}/month`}
                          />
                        )}

                        {preferences.preferred_locations && (
                          <Preference
                            label="Preferred locations"
                            value={preferences.preferred_locations}
                          />
                        )}

                        {preferences.desired_property_type &&
                          preferences.desired_property_type !==
                            "any" && (
                            <Preference
                              label="Property type"
                              value={
                                preferences.desired_property_type
                              }
                            />
                          )}

                        {preferences.desired_bedrooms > 0 && (
                          <Preference
                            label="Min bedrooms"
                            value={`${preferences.desired_bedrooms}+`}
                          />
                        )}

                        {preferences.desired_move_in_date && (
                          <Preference
                            label="Move-in date"
                            value={formatDate(
                              preferences.desired_move_in_date
                            )}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              );
            })()}

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">
                Reputation
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-4 gap-3 text-center">
                <Stat label="Rentals" value="—" />
                <Stat label="Rating" value="—" />
                <Stat label="Reviews" value="—" />
                <Stat label="Response" value="—" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function CapabilityChoice({
  selected,
  icon: Icon,
  title,
  description,
  onClick
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={`w-5 h-5 ${
            selected
              ? "text-primary"
              : "text-muted-foreground"
          }`}
        />

        <div className="flex-1">
          <p className="text-sm font-medium">{title}</p>

          <p className="text-xs text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>

        {selected && (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        )}
      </div>
    </button>
  );
}

function CapabilitySwitch({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
  bordered = false
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        bordered ? "pt-4 border-t border-border" : ""
      }`}
    >
      <div>
        <p className="text-sm font-medium">{title}</p>

        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>

      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function VerificationItem({
  label,
  done = false,
  pending = false,
  description
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          done
            ? "bg-success/10"
            : pending
            ? "bg-warning/10"
            : "bg-muted"
        }`}
      >
        {done ? (
          <CheckCircle2
            className="text-success"
            style={{ width: 18, height: 18 }}
          />
        ) : pending ? (
          <Loader2 className="w-4 h-4 text-warning animate-spin" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>

        <p className="text-xs text-muted-foreground mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}

function Preference({
  icon: Icon,
  label,
  value
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>

      <p className="font-medium capitalize">
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-lg font-bold font-heading">
        {value}
      </p>

      <p className="text-xs text-muted-foreground">
        {label}
      </p>
    </div>
  );
}