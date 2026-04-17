import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getToken } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { PizzaTracker } from "./PizzaTracker";
import type { PSATicket } from "@shared/types/psa";
import { useToast } from "@/hooks/use-toast";

function authFetch(path: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json());
}

export function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [, setLocation] = useLocation();
  const [reply, setReply] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: ticket, isLoading } = useQuery<PSATicket>({
    queryKey: ["/api/portal/tickets", ticketId],
    queryFn: () => authFetch(`/api/portal/tickets/${ticketId}`),
  });

  const addNote = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/portal/tickets/${ticketId}/notes`, { text });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/portal/tickets", ticketId] });
      setReply("");
      toast({ title: "Reply sent", description: "Your message has been added to the ticket." });
    },
    onError: () => toast({ title: "Error", description: "Failed to send reply.", variant: "destructive" }),
  });

  if (isLoading) return <div className="py-12 text-center text-muted-foreground text-sm">Loading ticket...</div>;
  if (!ticket) return <div className="py-12 text-center text-muted-foreground text-sm">Ticket not found.</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/portal/tickets")} className="gap-2 h-8">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <span className="text-sm text-muted-foreground">#{ticket.id}</span>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{ticket.summary}</CardTitle>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
            {ticket.assignedTo && <span>Assigned to: <strong>{ticket.assignedTo}</strong></span>}
            <span>Created: {new Date(ticket.dateCreated).toLocaleDateString()}</span>
            <span>Updated: {new Date(ticket.dateUpdated).toLocaleDateString()}</span>
          </div>
          {ticket.scheduledDate && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 mt-1">
              <Calendar className="h-3.5 w-3.5" />
              Scheduled for {new Date(ticket.scheduledDate).toLocaleDateString()}
            </div>
          )}
          {ticket.requiresOnsite && (
            <div className="flex items-center gap-1.5 text-xs text-purple-600 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              Onsite visit planned
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pizza tracker */}
          <div className="py-2">
            <PizzaTracker status={ticket.status} />
          </div>

          {ticket.statusDetail && (
            <div className="text-xs text-muted-foreground italic border-l-2 border-[#E77125] pl-3">
              {ticket.statusDetail}
            </div>
          )}

          {ticket.description && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</div>
              <div className="text-sm whitespace-pre-wrap text-[#394442] dark:text-gray-200">{ticket.description}</div>
            </div>
          )}

          {/* SLA */}
          {ticket.slaInfo && (
            <div className="grid grid-cols-2 gap-3">
              {ticket.slaInfo.responseTarget && (
                <div className={`p-2 rounded text-xs ${ticket.slaInfo.isBreached ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  <div className="font-semibold">Response Target</div>
                  <div>{new Date(ticket.slaInfo.responseTarget).toLocaleString()}</div>
                </div>
              )}
              {ticket.slaInfo.resolutionTarget && (
                <div className={`p-2 rounded text-xs ${ticket.slaInfo.isBreached ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  <div className="font-semibold">Resolution Target</div>
                  <div>{new Date(ticket.slaInfo.resolutionTarget).toLocaleString()}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(ticket.notes || []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No updates yet.</p>
          )}
          {(ticket.notes || []).map(note => (
            <div key={note.id} className="flex gap-3">
              <div className="h-7 w-7 rounded-full bg-[#394442]/10 flex items-center justify-center text-xs font-bold text-[#394442] dark:text-white flex-shrink-0">
                {note.createdBy[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-[#394442] dark:text-white">{note.createdBy}</span>
                  <span className="text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-sm mt-1 text-[#394442] dark:text-gray-200 whitespace-pre-wrap">{note.text}</div>
              </div>
            </div>
          ))}

          {/* Reply box */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
            <Textarea
              placeholder="Add a reply or provide additional information..."
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
            <Button
              onClick={() => reply.trim() && addNote.mutate(reply.trim())}
              disabled={!reply.trim() || addNote.isPending}
              className="bg-[#E77125] hover:bg-[#E77125]/90 text-white"
              size="sm"
            >
              {addNote.isPending ? "Sending..." : "Send Reply"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
