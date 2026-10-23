import { useState, useEffect, useCallback } from "react";
import { zimrent } from "@/api/zimrentClient";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ShieldCheck,
  Loader2,
  AlertCircle
} from "lucide-react";

// Identity verification: the user uploads a photo or scan of an ID document
// (private — only they and admins can see it). An admin reviews it in the
// Admin Console. Identity is separate from property authority: this proves
// who the person is, not that they may list a particular property.
//
//   POST /uploads { kind: 'document', document_type: 'identity' }
//   POST /identity-verification { evidence_document_id }
//   GET  /identity-verification/me
export default function IdentityVerificationCard() {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRecord(await zimrent.identityVerification.me());
    } catch (e) {
      setRecord({ status: "unverified" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!file) {
      setError("Choose a photo or scan of your ID first.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const document = await zimrent.uploads.upload(file, "document", {
        documentType: "identity"
      });
      await zimrent.identityVerification.submit(document.id);
      setFile(null);
      await load();
    } catch (e) {
      setError(e.message || "Unable to submit your ID. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const status = record?.status || "unverified";
  const verified = status === "verified";
  const pending = status === "pending";
  const rejected = status === "rejected";
  const canSubmit = !loading && !verified && !pending;

  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          verified ? "bg-success/10" : pending ? "bg-warning/10" : "bg-muted"
        }`}
      >
        {verified ? (
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

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Identity verification</p>

        {loading && (
          <p className="text-xs text-muted-foreground mt-0.5">Checking...</p>
        )}

        {verified && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Your identity has been verified.
          </p>
        )}

        {pending && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Your ID is under review. We'll update this page once it has been
            checked.
          </p>
        )}

        {rejected && (
          <p className="text-xs text-destructive mt-0.5 flex items-start gap-1">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Your last submission was not accepted. Please upload a clear photo
            or scan of a valid ID and try again.
          </p>
        )}

        {canSubmit && (
          <div className="mt-2 space-y-2">
            {!rejected && (
              <p className="text-xs text-muted-foreground">
                Upload a photo or scan of your national ID, passport or driver's
                licence (JPG, PNG or PDF, up to 15 MB). It is stored privately
                — only you and our verification team can see it.
              </p>
            )}

            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError("");
              }}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
            />

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={submitting || !file}
            >
              {submitting && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              {rejected ? "Resubmit for verification" : "Submit for verification"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
