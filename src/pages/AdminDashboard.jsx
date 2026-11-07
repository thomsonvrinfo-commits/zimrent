import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { zimrent } from "@/api/zimrentClient";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, UserCheck, Building2, FileCheck, ListChecks,
  CheckCircle2, XCircle, Eye, Loader2, X, ExternalLink
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
  pending_verification: "warning",
  active: "success",
  inactive: "secondary",
};

export default function AdminDashboard() {
  const { user } = useAuth();
const { isAdmin } = useProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = ["identity", "property", "authority", "listings"].includes(searchParams.get("tab"))
    ? searchParams.get("tab")
    : "identity";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [identityQueue, setIdentityQueue] = useState([]);
  const [propertyQueue, setPropertyQueue] = useState([]);
  const [authorityQueue, setAuthorityQueue] = useState([]);
  const [listingQueue, setListingQueue] = useState([]);
  const [actioningId, setActioningId] = useState(null);
  const [viewingDocId, setViewingDocId] = useState(null);
  const [preview, setPreview] = useState(null); // { url, type, title }

  const loadQueues = useCallback(async () => {
    try {
      const [identity, property, authority, listings] = await Promise.all([
        zimrent.admin.identityQueue(),
        zimrent.admin.propertyQueue(),
        zimrent.admin.authorityQueue(),
        zimrent.admin.listingQueue(),
      ]);
      setIdentityQueue(identity);
      setPropertyQueue(property);
      setAuthorityQueue(authority);
      setListingQueue(listings);
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
    if (!isAdmin) { navigate("/"); return; }
    loadQueues();
  }, [user, isAdmin, navigate, loadQueues]);

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

  // Inline evidence preview (instead of opening a raw blob: tab).
  const viewDocument = async (kind, documentId, title = "Evidence document") => {
    if (!documentId) return;
    setViewingDocId(documentId);
    try {
      const { url, type } = await zimrent.admin.documentPreview(kind, documentId);
      setPreview({ url, type, title });
    } catch (e) {
      alert(e.message || "Could not load that document.");
    } finally {
      setViewingDocId(null);
    }
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  if (loading) return <LoadingState label="Loading admin console..." />;

  const pendingIdentity = identityQueue.filter((r) => r.status === "pending");
  const pendingProperty = propertyQueue.filter((r) => r.status === "pending");
  const pendingAuthority = authorityQueue.filter((r) => r.status === "pending");
  const pendingListings = listingQueue.filter((r) => r.status === "pending_verification");

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

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-5">
          <TabsTrigger value="identity" className="px-1 text-[11px] sm:text-sm">Identity ({pendingIdentity.length})</TabsTrigger>
          <TabsTrigger value="property" className="px-1 text-[11px] sm:text-sm">Property ({pendingProperty.length})</TabsTrigger>
          <TabsTrigger value="authority" className="px-1 text-[11px] sm:text-sm">Authority ({pendingAuthority.length})</TabsTrigger>
          <TabsTrigger value="listings" className="px-1 text-[11px] sm:text-sm">Listings ({pendingListings.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-3">
          <p className="text-xs text-muted-foreground">The number on the tab is IDs waiting for review. Reviewed IDs stay listed below.</p>
          {identityQueue.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No identity requests"
              description="Identity verification submissions will appear here."
            />
          ) : identityQueue.map((r) => (
            <Card key={r.id} className="border-border">
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm break-words sm:truncate">{r.display_name || r.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">
                    {r.email} · Submitted {formatDate(r.created_date)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <StateBadge status={r.status} label={r.status} color={STATUS_COLOR[r.status] || "secondary"} />
                  {r.evidence_document_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={viewingDocId === r.evidence_document_id}
                      onClick={() => viewDocument("identity", r.evidence_document_id, `ID — ${r.display_name || r.email}`)}
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
          <p className="text-xs text-muted-foreground">Property verification requests can't be submitted yet, so this tab is expected to be empty. Property trust currently comes from approved authority plus an approved listing.</p>
          {propertyQueue.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No property requests"
              description="Property verification submissions will appear here."
            />
          ) : propertyQueue.map((r) => (
            <Card key={r.id} className="border-border">
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm break-words sm:truncate">{r.title || "Untitled property"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">
                    {r.suburb ? `${r.suburb}, ` : ""}{r.city} · Submitted {formatDate(r.created_date)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
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
          <p className="text-xs text-muted-foreground">The number on the tab is authority requests waiting for review. Reviewed requests stay listed below.</p>
          {authorityQueue.length === 0 ? (
            <EmptyState
              icon={FileCheck}
              title="No authority requests"
              description="Property authority submissions will appear here."
            />
          ) : authorityQueue.map((r) => (
            <Card key={r.id} className="border-border">
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm break-words sm:truncate">{r.title || "Untitled property"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">
                    {r.display_name || r.email} · {r.suburb ? `${r.suburb}, ` : ""}{r.city} · Submitted {formatDate(r.created_date)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <StateBadge status={r.status} label={r.status} color={STATUS_COLOR[r.status] || "secondary"} />
                  {r.evidence_document_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={viewingDocId === r.evidence_document_id}
                      onClick={() => viewDocument("property", r.evidence_document_id, `Authority evidence — ${r.title || "property"}`)}
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

        <TabsContent value="listings" className="space-y-3">
          <p className="text-xs text-muted-foreground">The number on the tab is listings waiting for approval. Approving a listing makes it live in Discover.</p>
          {listingQueue.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No listings to review"
              description="Listings submitted by owners will appear here."
            />
          ) : listingQueue.map((r) => (
            <Card key={r.id} className="border-border">
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm break-words sm:truncate">{r.title || "Untitled property"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">
                    {r.display_name || r.email} · {r.suburb ? `${r.suburb}, ` : ""}{r.city} · Submitted {formatDate(r.created_date)}
                  </p>
                  {r.owner_authority_status && r.owner_authority_status !== "approved" && (
                    <p className="text-xs text-destructive mt-0.5">
                      Owner authority is {r.owner_authority_status} — this listing cannot be activated.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <StateBadge
                    status={r.status}
                    label={r.status === "pending_verification" ? "pending" : r.status}
                    color={STATUS_COLOR[r.status] || "secondary"}
                  />
                  {r.status === "pending_verification" && (
                    <>
                      <Button
                        size="sm" variant="outline" className="border-destructive/30 text-destructive"
                        disabled={actioningId === r.id}
                        onClick={() => runReview(r.id, () => zimrent.admin.reviewListing(r.id, "rejected"))}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={actioningId === r.id}
                        onClick={() => runReview(r.id, () => zimrent.admin.reviewListing(r.id, "active"))}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
                      </Button>
                    </>
                  )}
                  {r.status === "active" && (
                    <Button
                      size="sm" variant="outline"
                      disabled={actioningId === r.id}
                      onClick={() => runReview(r.id, () => zimrent.admin.reviewListing(r.id, "inactive"))}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3"
          onClick={closePreview}
        >
          <div
            className="bg-background rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
              <p className="font-medium text-sm truncate">{preview.title}</p>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </a>
                <Button size="sm" variant="outline" onClick={closePreview}>
                  <X className="w-3.5 h-3.5 mr-1" /> Close
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 bg-muted/30">
              {preview.type.startsWith("image/") ? (
                <img
                  src={preview.url}
                  alt={preview.title}
                  className="max-h-[75vh] w-auto max-w-full mx-auto object-contain"
                />
              ) : preview.type === "application/pdf" ? (
                <div className="space-y-2">
                  <iframe
                    src={preview.url}
                    title={preview.title}
                    className="w-full h-[70vh] rounded border border-border bg-white"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    PDF not showing? Tap <strong>Open</strong> above to view it in a new tab.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground p-6 text-center">
                  This file type can't be previewed here. Use <strong>Open</strong> to view or download it.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
