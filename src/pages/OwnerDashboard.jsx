import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2, Calendar, FileText, Plus, ArrowRight,
  Wrench
} from "lucide-react";
import StateBadge from "@/components/StateBadge";
import { EmptyState, LoadingState } from "@/components/EmptyState";
import {
  LISTING_STATUS, VIEWING_STATUS, APPLICATION_STATUS, formatCurrency, formatDate
} from "@/lib/rental-utils";

export default function OwnerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [listings, setListings] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [props, lsts, views, apps, tens, maint, convos] = await Promise.all([
          zimrent.entities.Property.filter({ created_by_id: user.id }, "-created_date", 50),
          zimrent.entities.Listing.filter({ created_by_id: user.id }, "-created_date", 50),
          zimrent.entities.Viewing.filter({ owner_id: user.id }, "-created_date", 20),
          zimrent.entities.Application.filter({ owner_id: user.id }, "-created_date", 20),
          zimrent.entities.Tenancy.filter({ owner_id: user.id }, "-created_date", 20),
          zimrent.entities.MaintenanceRequest.filter({ owner_id: user.id }, "-created_date", 20),
          zimrent.entities.Conversation.filter({})
        ]);
        setProperties(props || []);
        setListings(lsts || []);
        setViewings(views || []);
        setApplications(apps || []);
        setTenancies(tens || []);
        setMaintenance(maint || []);
        setConversations((convos || []).filter(c => c.data?.participants?.includes(user.id)));
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [user]);

  if (loading) return <LoadingState label="Loading your dashboard..." />;

  const activeListings = listings.filter(l => l.data?.status === "active");
  const pendingViewings = viewings.filter(v => v.data?.status === "requested");
  const pendingApps = applications.filter(a => a.data?.status === "submitted" || a.data?.status === "under_review");
  const openMaintenance = maintenance.filter(m => m.data?.status === "submitted" || m.data?.status === "acknowledged");
  const activeTenancies = tenancies.filter(t => t.data?.status === "active");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">Owner Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your properties, applications, and tenancies.</p>
        </div>
        <Button asChild><Link to="/add-property"><Plus className="w-4 h-4 mr-2" /> Add property</Link></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Building2} label="Properties" value={properties.length} link="/my-properties" />
        <StatCard icon={Calendar} label="Pending viewings" value={pendingViewings.length} color="warning" />
        <StatCard icon={FileText} label="Pending applications" value={pendingApps.length} color="warning" />
        <StatCard icon={Wrench} label="Open maintenance" value={openMaintenance.length} color={openMaintenance.length > 0 ? "warning" : "secondary"} />
      </div>

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Add your first property to start receiving enquiries and applications."
          action={<Button asChild><Link to="/add-property"><Plus className="w-4 h-4 mr-2" /> Add your first property</Link></Button>}
        />
      ) : (
        <div className="space-y-6">
          {/* Pending viewings */}
          {pendingViewings.length > 0 && (
            <Section title="Viewing requests to review">
              <div className="space-y-2">
                {pendingViewings.map(v => {
                  const info = VIEWING_STATUS[v.data?.status];
                  return (
                    <Card key={v.id} className="border-border">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{v.data?.property_title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(v.data?.requested_date)} at {v.data?.requested_time} · {v.data?.number_of_attendees} attendee(s)</p>
                          {v.data?.message && <p className="text-xs text-muted-foreground mt-1 italic">"{v.data.message}"</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={async () => {
                            await zimrent.entities.Viewing.update(v.id, { status: "declined" });
                            setViewings(prev => prev.map(x => x.id === v.id ? { ...x, data: { ...x.data, status: "declined" } } : x));
                          }}>Decline</Button>
                          <Button size="sm" onClick={async () => {
                            await zimrent.entities.Viewing.update(v.id, { status: "accepted" });
                            await zimrent.entities.Notification.create({
                              user_id: v.data?.tenant_id, type: "VIEWING_ACCEPTED",
                              title: "Viewing accepted", message: `Your viewing for "${v.data?.property_title}" was accepted.`,
                              link: "/tenant-dashboard"
                            });
                            setViewings(prev => prev.map(x => x.id === v.id ? { ...x, data: { ...x.data, status: "accepted" } } : x));
                          }}>Accept</Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Pending applications */}
          {pendingApps.length > 0 && (
            <Section title="Applications to review">
              <div className="space-y-2">
                {pendingApps.map(a => {
                  const info = APPLICATION_STATUS[a.data?.status];
                  return (
                    <Card key={a.id} className="border-border">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{a.data?.property_title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Move-in: {formatDate(a.data?.desired_move_in_date)} · {a.data?.occupants} occupant(s)</p>
                          {a.data?.employment_info && <p className="text-xs text-muted-foreground mt-1">Employment: {a.data.employment_info}</p>}
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/application/${a.id}`}>Review</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Active tenancies */}
          {activeTenancies.length > 0 && (
            <Section title="Active tenancies">
              <div className="space-y-2">
                {activeTenancies.map(t => (
                  <Card key={t.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{t.data?.property_title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Rent: {formatCurrency(t.data?.rent, t.data?.currency)}/month · Next due: {formatDate(t.data?.next_payment_due)}</p>
                      </div>
                      <Button size="sm" variant="outline" asChild><Link to={`/tenancy/${t.id}`}>Manage <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link></Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          {/* Listings overview */}
          <Section title="Your listings">
            <div className="space-y-2">
              {listings.map(l => {
                const info = LISTING_STATUS[l.data?.status];
                const prop = properties.find(p => p.id === l.data?.property_id);
                return (
                  <Card key={l.id} className="border-border">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{prop?.data?.title || l.data?.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(l.data?.monthly_rent, l.data?.currency)}/month · {prop?.data?.suburb}, {prop?.data?.city}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" asChild><Link to={`/property/${l.data?.property_id}`}>View</Link></Button>
                        <StateBadge status={l.data?.status} label={info?.label} color={info?.color} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, link, color = "primary" }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    secondary: "bg-muted text-muted-foreground"
  };
  const card = (
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
  );
  return link ? <Link to={link}>{card}</Link> : card;
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="font-semibold font-heading mb-3">{title}</h2>
      {children}
    </div>
  );
}