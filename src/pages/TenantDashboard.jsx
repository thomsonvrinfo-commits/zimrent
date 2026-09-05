import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart, Calendar, FileText, Home, MessageSquare, Lock, Clock, ArrowRight, Wrench, CreditCard, CheckCircle2, ShieldCheck
} from "lucide-react";
import PropertyCard from "@/components/PropertyCard";
import StateBadge from "@/components/StateBadge";
import { EmptyState, LoadingState } from "@/components/EmptyState";
import {
  RESERVATION_STATUS, APPLICATION_STATUS, VIEWING_STATUS, MAINTENANCE_STATUS,
  formatCurrency, formatDate, timeRemaining
} from "@/lib/rental-utils";

export default function TenantDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const [loading, setLoading] = useState(true);
  const [savedProperties, setSavedProperties] = useState([]);
  const [savedListings, setSavedListings] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [properties, setProperties] = useState({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [saved, views, apps, resvs, tenanciesData, convos, pays, maints, notifs] = await Promise.all([
          zimrent.entities.SavedProperty.filter({ user_id: user.id }),
          zimrent.entities.Viewing.filter({ tenant_id: user.id }, "-created_date", 20),
          zimrent.entities.Application.filter({ tenant_id: user.id }, "-created_date", 20),
          zimrent.entities.Reservation.filter({ tenant_id: user.id }, "-created_date", 20),
          zimrent.entities.Tenancy.filter({ tenant_id: user.id }, "-created_date", 10),
          zimrent.entities.Conversation.filter({} ),
          zimrent.entities.Payment.filter({ user_id: user.id }, "-created_date", 20),
          zimrent.entities.MaintenanceRequest.filter({ tenant_id: user.id }, "-created_date", 20),
          zimrent.entities.Notification.filter({ user_id: user.id }, "-created_date", 20)
        ]);
        const myConvos = (convos || []).filter(c => c.data?.participants?.includes(user.id));
        setConversations(myConvos);
        setViewings(views || []);
        setApplications(apps || []);
        setReservations(resvs || []);
        setTenancies(tenanciesData || []);
        setPayments(pays || []);
        setMaintenance(maints || []);
        setNotifications(notifs || []);

        // Load saved properties + their listings
        const savedData = saved || [];
        const propIds = [...new Set(savedData.map(s => s.data?.property_id).filter(Boolean))];
        const props = await Promise.all(propIds.map(id => zimrent.entities.Property.get(id).catch(() => null)));
        const propMap = {};
        props.forEach(p => { if (p) propMap[p.id] = p; });
        setProperties(prev => ({ ...prev, ...propMap }));
        setSavedProperties(savedData.map(s => propMap[s.data?.property_id]).filter(Boolean));

        // Load listings for saved properties
        const listingPromises = savedData.map(s => zimrent.entities.Listing.filter({ property_id: s.data?.property_id }).catch(() => []));
        const listingResults = await Promise.all(listingPromises);
        const listingMap = {};
        savedData.forEach((s, i) => {
          const lst = (listingResults[i] || []).find(l => l.data?.status === "active") || (listingResults[i] || [])[0];
          if (lst) listingMap[s.data?.property_id] = lst;
        });
        setSavedListings(listingMap);

        // Load properties for viewings/apps/resvs
        const allPropIds = [...new Set([
          ...(views || []).map(v => v.data?.property_id),
          ...(apps || []).map(a => a.data?.property_id),
          ...(resvs || []).map(r => r.data?.property_id),
          ...(tenanciesData || []).map(t => t.data?.property_id)
        ].filter(Boolean))];
        const moreProps = await Promise.all(allPropIds.map(id => zimrent.entities.Property.get(id).catch(() => null)));
        setProperties(prev => {
          const updated = { ...prev };
          moreProps.forEach(p => { if (p) updated[p.id] = p; });
          return updated;
        });
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [user]);

  // Tick for countdown
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const activeReservation = reservations.find(r => r.data?.status === "active" || r.data?.status === "payment_pending");
  const activeTenancy = tenancies.find(t => t.data?.status === "active");
  const upcomingViewings = viewings.filter(v => v.data?.status === "accepted" || v.data?.status === "requested");
  const pendingApps = applications.filter(a => a.data?.status === "submitted" || a.data?.status === "under_review");

  if (loading) return <LoadingState label="Loading your dashboard..." />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold font-heading mb-1">My Dashboard</h1>
      <p className="text-muted-foreground text-sm mb-6">Track your rental journey in one place.</p>

      {/* Quick status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatusCard icon={Calendar} label="Upcoming viewings" value={upcomingViewings.length} link="/tenant-dashboard?tab=viewings" color="warning" />
        <StatusCard icon={FileText} label="Pending applications" value={pendingApps.length} link="/tenant-dashboard?tab=applications" color="warning" />
        <StatusCard icon={Lock} label="Active reservation" value={activeReservation ? "Yes" : "None"} link="/tenant-dashboard?tab=reservations" color={activeReservation ? "success" : "secondary"} />
        <StatusCard icon={Home} label="Active tenancy" value={activeTenancy ? "Yes" : "None"} link={activeTenancy ? `/tenancy/${activeTenancy.id}` : "/"} color={activeTenancy ? "success" : "secondary"} />
      </div>

      {/* Active reservation countdown */}
      {activeReservation && activeReservation.data?.status === "active" && (
        <Card className="border-success/30 bg-success/5 mb-6">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
              <Lock className="w-6 h-6 text-success" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Reserved: {activeReservation.data?.property_title}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Reservation expires in {timeRemaining(activeReservation.data?.expires_at)}
              </p>
            </div>
            <Button asChild><Link to={`/tenancy/reservation/${activeReservation.id}`}>Complete application</Link></Button>
          </CardContent>
        </Card>
      )}

      {/* Rental journey tracker */}
      <Card className="border-border mb-6">
        <CardContent className="p-5">
          <h2 className="font-semibold font-heading mb-4">Your rental journey</h2>
          <div className="flex flex-wrap gap-3">
            <JourneyStep icon={CheckCircle2} label="Profile" done={true} />
            <JourneyStep icon={ShieldCheck} label="Verification" done={false} link="/profile" />
            <JourneyStep icon={Heart} label={`Saved (${savedProperties.length})`} done={savedProperties.length > 0} />
            <JourneyStep icon={Calendar} label={`Viewings (${upcomingViewings.length})`} done={upcomingViewings.length > 0} link="/tenant-dashboard?tab=viewings" />
            <JourneyStep icon={FileText} label={`Applications (${pendingApps.length})`} done={applications.length > 0} link="/tenant-dashboard?tab=applications" />
            <JourneyStep icon={Lock} label="Reservation" done={!!activeReservation} link="/tenant-dashboard?tab=reservations" />
            <JourneyStep icon={Home} label="Tenancy" done={!!activeTenancy} link={activeTenancy ? `/tenancy/${activeTenancy.id}` : null} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="viewings">Viewings</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {activeTenancy && (
            <Section title="Your rental">
              <Card className="border-border">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{activeTenancy.data?.property_title}</p>
                      <p className="text-sm text-muted-foreground">Rent: {formatCurrency(activeTenancy.data?.rent, activeTenancy.data?.currency)}/month · Next due: {formatDate(activeTenancy.data?.next_payment_due)}</p>
                    </div>
                    <Button asChild><Link to={`/tenancy/${activeTenancy.id}`}>View rental <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
                  </div>
                </CardContent>
              </Card>
            </Section>
          )}
          <Section title="Recent messages">
            {conversations.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No messages yet" description="Start a conversation from any property page." />
            ) : (
              <div className="space-y-2">
                {conversations.slice(0, 3).map(c => (
                  <Link key={c.id} to={`/messages/${c.id}`} className="block p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors">
                    <p className="font-medium text-sm">{c.data?.property_title || "Conversation"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.data?.last_message_preview || "No messages yet"}</p>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="saved">
          {savedProperties.length === 0 ? (
            <EmptyState icon={Heart} title="No saved properties" description="Save properties you're interested in to find them quickly later." action={<Button asChild><Link to="/">Browse properties</Link></Button>} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedProperties.map(p => (
                <PropertyCard key={p.id} property={p} listing={savedListings[p.id]} saved={true} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="viewings">
          {viewings.length === 0 ? (
            <EmptyState icon={Calendar} title="No viewing requests" description="Request a viewing from any property page." action={<Button asChild><Link to="/">Find properties</Link></Button>} />
          ) : (
            <div className="space-y-3">
              {viewings.map(v => {
                const info = VIEWING_STATUS[v.data?.status];
                return (
                  <Card key={v.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{v.data?.property_title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(v.data?.requested_date)} at {v.data?.requested_time} · {v.data?.number_of_attendees} attendee(s)</p>
                      </div>
                      <StateBadge status={v.data?.status} label={info?.label} color={info?.color} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications">
          {applications.length === 0 ? (
            <EmptyState icon={FileText} title="No applications" description="Reserve a property and submit an application to get started." />
          ) : (
            <div className="space-y-3">
              {applications.map(a => {
                const info = APPLICATION_STATUS[a.data?.status];
                return (
                  <Card key={a.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{a.data?.property_title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Move-in: {formatDate(a.data?.desired_move_in_date)} · {a.data?.occupants} occupant(s)</p>
                        {a.data?.owner_note && <p className="text-xs text-muted-foreground mt-1 italic">"{a.data.owner_note}"</p>}
                      </div>
                      <StateBadge status={a.data?.status} label={info?.label} color={info?.color} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reservations">
          {reservations.length === 0 ? (
            <EmptyState icon={Lock} title="No reservations" description="Reserve a property to temporarily hold it while you complete your application." />
          ) : (
            <div className="space-y-3">
              {reservations.map(r => {
                const info = RESERVATION_STATUS[r.data?.status];
                return (
                  <Card key={r.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{r.data?.property_title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(r.data?.amount, r.data?.currency)} · {formatDate(r.data?.activated_at || r.created_date)}
                          {r.data?.status === "active" && ` · Expires in ${timeRemaining(r.data?.expires_at)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(r.data?.status === "payment_pending") && (
                          <Button size="sm" asChild><Link to={`/reserve/payment/${r.id}`}>Complete payment</Link></Button>
                        )}
                        <StateBadge status={r.data?.status} label={info?.label} color={info?.color} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments yet" description="Your reservation fees, rent payments, and other transactions will appear here." />
          ) : (
            <div className="space-y-3">
              {payments.map(p => (
                <Card key={p.id} className="border-border">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm capitalize">{p.data?.type} payment</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(p.data?.completed_at || p.created_date)}
                        {p.data?.is_test && " · Test transaction"}
                        {p.data?.provider_reference && ` · Ref: ${p.data.provider_reference.substring(0, 20)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(p.data?.amount, p.data?.currency)}</p>
                      <StateBadge status={p.data?.status} label={p.data?.status} color={p.data?.status === "success" ? "success" : p.data?.status === "failed" ? "destructive" : "warning"} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="maintenance">
          {maintenance.length === 0 ? (
            <EmptyState icon={Wrench} title="No maintenance requests" description="Report issues from your active tenancy workspace." />
          ) : (
            <div className="space-y-3">
              {maintenance.map(m => {
                const info = MAINTENANCE_STATUS[m.data?.status];
                return (
                  <Card key={m.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{m.data?.property_title}</p>
                        <StateBadge status={m.data?.status} label={info?.label} color={info?.color} />
                      </div>
                      <p className="text-sm text-muted-foreground">{m.data?.description}</p>
                      <p className="text-xs text-muted-foreground mt-1 capitalize">{m.data?.category} · {m.data?.priority} priority</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JourneyStep({ icon: Icon, label, done, link }) {
  const content = (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"} ${link ? "hover:bg-primary/10 cursor-pointer" : ""}`}>
      <Icon className="w-4 h-4" />
      <span className="font-medium">{label}</span>
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function StatusCard({ icon: Icon, label, value, link, color }) {
  const colorMap = {
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
    secondary: "bg-muted text-muted-foreground"
  };
  return (
    <Link to={link} className="block">
      <Card className="border-border hover:border-primary/30 transition-colors">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold font-heading leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="font-semibold font-heading mb-3">{title}</h2>
      {children}
    </div>
  );
}