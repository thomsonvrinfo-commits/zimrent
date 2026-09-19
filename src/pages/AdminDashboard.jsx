import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, UserCheck, Building2, FileCheck,
  CheckCircle2, XCircle, Eye, Loader2
} from "lucide-react";
import StateBadge from "@/components/StateBadge";
import { EmptyState, LoadingState } from "@/components/EmptyState";
import { formatDate } from "@/lib/rental-utils";

// Matches the status enums in workers/api/src/routes/admin/verification.ts.
const STATUS_COLOR = {
  pending: "warning",
  verified: "success",
  approved: "success",
  rejected: "destructive",
  revoked: "destructive",
  unverified: "secondary",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [identityQueue, setIdentityQueue] = useState([]);
  const [propertyQueue, setPropertyQueue] = useState([]);
  const [authorityQueue, setAuthorityQueue] = useState([]);
  const [actioningId, setActioningId] = useState(null);
  const [viewingDocId, setViewingDocId] = useState(null);

  const loadQueues = useCallback(async () => {
    try {
      const [identity, property, authority] = await Promise.all([
        zimrent.admin.identityQueue(),
        zimrent.admin.propertyQueue(),
        zimrent.admin.authorityQueue(),
      ]);
      setIdentityQueue(identity);
      setPropertyQueue(property);
      setAuthorityQueue(authority);
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load verification queues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    // Client-side gate only, for UX (hide the console, redirect away).
    // The real authorization boundary is the API's requireAdmin middleware
    // (live is_admin DB check) — every call below is enforced there
    // regardless of what happens in this component.
    if (!user.is_admin) { navigate("/"); return; }
    loadQueues();
  }, [user, navigate, loadQueues]);

  const runReview = async (id, action) => {
    setActioningId(id);
    try {
      await action();
      await loadQueues();
    } catch (e) {
      alert(e.message || "That action failed.");
    } finally {
      setActioningId(null);
    }
  };

  const viewDocument = async (kind, documentId) => {
    if (!documentId) return;
    setViewingDocId(documentId);
    try {
      const url = await zimrent.admin.documentUrl(kind, documentId);
      window.open(url, "_blank", "noopener,noreferrer");
      // Give the new tab a chance to load the blob before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert(e.message || "Could not load that document.");
    } finally {
      setViewingDocId(null);
    }
  };

  if (loading) return <LoadingState label="Loading admin console..." />;

  const pendingIdentity = identityQueue.filter((r) => r.status === "pending");
  const pendingProperty = propertyQueue.filter((r) => r.status === "pending");
  const pendingAuthority = authorityQueue.filter((r) => r.status === "pending");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Admin Console</h1>
          <p className="text-sm text-muted-foreground">Verification queues and approvals</p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 mb-5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-5">
          <TabsTrigger value="identity">Identity ({pendingIdentity.length})</TabsTrigger>
          <TabsTrigger value="property">Property ({pendingProperty.length})</TabsTrigger>
          <TabsTrigger value="authority">Authority ({pendingAuthority.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-3">
          {identityQueue.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No identity requests"
              description="Identity verification submissions will appear here."
            />
          ) : identityQueue.map((r) => (
            <Card key={r.id} className="border-border">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.display_name || r.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.email} · Submitted {formatDate(r.created_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StateBadge status={r.status} label={r.status} color={STATUS_COLOR[r.status] || "secondary"} />
                  {r.evidence_document_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={viewingDocId === r.evidence_document_id}
                      onClick={() => viewDocument("identity", r.evidence_document_id)}
                    >
                      {viewingDocId === r.evidence_document_id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <>
                      <Button
                        size="sm" variant="outline" className="border-destructive/30 text-destructive"
                        disabled={actioningId === r.id}
                        onClick={() => runReview(r.id, () => zimrent.admin.reviewIdentity(r.id, "rejected"))}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={actioningId === r.id}
                        onClick={() => runReview(r.id, () => zimrent.admin.reviewIdentity(r.id, "verified"))}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Verify
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="property" className="space-y-3">
          {propertyQueue.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No property requests"
              description="Property verification submissions will appear here."
            />
          ) : propertyQueue.map((r) => (
            <Card key={r.id} className="border-border">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.title || "Untitled property"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.suburb ? `${r.suburb}, ` : ""}{r.city} · Submitted {formatDate(r.created_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StateBadge status={r.status} label={r.status} color={STATUS_COLOR[r.status] || "secondary"} />
                  {r.status === "pending" && (
                    <>
                      <Button
                        size="sm" variant="outline" className="border-destructive/30 text-destructive"
                        disabled={actioningId === r.id}
                        onClick={() => runReview(r.id, () => zimrent.admin.reviewProperty(r.id, "rejected"))}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={actioningId === r.id}
                        onClick={() => runReview(r.id, () => zimrent.admin.reviewProperty(r.id, "verified"))}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Verify
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="authority" className="space-y-3">
          {authorityQueue.length === 0 ? (
            <EmptyState
              icon={FileCheck}
              title="No authority requests"
              description="Property authority submissions will appear here."
            />
          ) : authorityQueue.map((r) => (
            <Card key={r.id} className="border-border">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.title || "Untitled property"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.display_name || r.email} · {r.suburb ? `${r.suburb}, ` : ""}{r.city} · Submitted {formatDate(r.created_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StateBadge status={r.status} label={r.status} color={STATUS_COLOR[r.status] || "secondary"} />
                  {r.evidence_document_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={viewingDocId === r.evidence_document_id}
                      onClick={() => viewDocument("property", r.evidence_document_id)}
                    >
                      {viewingDocId === r.evidence_document_id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <>
                      <Button
                        size="sm" variant="outline" className="border-destructive/30 text-destructive"
                        disabled={actioningId === r.id}
                        onClick={() => runReview(r.id, () => zimrent.admin.reviewAuthority(r.id, "rejected"))}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={actioningId === r.id}
                        onClick={() => runReview(r.id, () => zimrent.admin.reviewAuthority(r.id, "approved"))}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
