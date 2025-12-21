"use client";

import { useState } from "react";
import { MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckinFormDialog } from "./checkin-form-dialog";

interface CheckinButtonProps {
  placeId: string;
  placeName: string;
  currentUserId?: string;
  disabled?: boolean;
  disabledReason?: string;
  onSuccess?: () => void;
}

export function CheckinButton({
  placeId,
  placeName,
  currentUserId,
  disabled,
  disabledReason,
  onSuccess,
}: CheckinButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);

  if (!currentUserId) {
    return (
      <Button variant="outline" size="sm" disabled>
        <MapPin className="h-4 w-4 mr-2" />
        Sign in to Check In
      </Button>
    );
  }

  if (justCheckedIn) {
    return (
      <Button variant="outline" size="sm" disabled className="text-green-600">
        <Check className="h-4 w-4 mr-2" />
        Checked In!
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={disabled}
        title={disabledReason}
      >
        <MapPin className="h-4 w-4 mr-2" />
        Check In
      </Button>

      <CheckinFormDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        placeId={placeId}
        placeName={placeName}
        onSuccess={() => {
          setShowDialog(false);
          setJustCheckedIn(true);
          onSuccess?.();
          // Reset after 3 seconds
          setTimeout(() => setJustCheckedIn(false), 3000);
        }}
      />
    </>
  );
}
