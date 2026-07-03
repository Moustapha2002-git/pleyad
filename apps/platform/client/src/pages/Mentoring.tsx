import { useState } from "react";
import { GraduationCap, Video } from "lucide-react";
import { trpc } from "../lib/trpc";
import { VideoCall } from "../components/VideoCall";
import { MessageThread } from "../components/MessageThread";
import { callRoomName } from "../lib/room";
import { Avatar, Button, Card, EmptyState, PageHeader, Spinner } from "../components/ui";

export default function Mentoring() {
  const me = trpc.auth.me.useQuery();
  const mentors = trpc.mentor.myMentors.useQuery();
  const ring = trpc.calls.ring.useMutation();
  const cancel = trpc.calls.cancel.useMutation();
  const [inCall, setInCall] = useState(false);

  const orgPublicId = me.data?.activeOrganization?.publicId ?? "";
  const myId = me.data?.id ?? 0;
  const myName = me.data?.name ?? me.data?.email ?? "Learner";
  const mentor = mentors.data?.[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Mentoring" subtitle="Your mentor in this workspace." />

      {mentors.isLoading ? (
        <Spinner label="Loading…" />
      ) : mentor ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={mentor.name ?? mentor.email ?? "?"} className="h-12 w-12 text-sm" />
              <div>
                <div className="font-semibold text-navy-900">{mentor.name ?? mentor.email}</div>
                <div className="text-sm text-ink/50">Your mentor</div>
              </div>
            </div>
            <Button
              icon={Video}
              onClick={() => {
                ring.mutate({
                  toUserId: mentor.id,
                  room: callRoomName(orgPublicId, myId, mentor.id),
                });
                setInCall(true);
              }}
            >
              Video call
            </Button>
          </Card>

          {inCall && (
            <VideoCall
              room={callRoomName(orgPublicId, myId, mentor.id)}
              displayName={myName}
              onClose={() => {
                cancel.mutate({ toUserId: mentor.id });
                setInCall(false);
              }}
            />
          )}

          <MessageThread
            withUserId={mentor.id}
            title={`Messages with ${mentor.name ?? "your mentor"}`}
          />
        </>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="No mentor assigned yet"
          description="When a mentor is assigned to you, they'll appear here."
        />
      )}
    </div>
  );
}
