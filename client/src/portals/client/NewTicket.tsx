import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function NewTicket() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Normal");

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/portal/tickets", { summary, description, priority });
      return res.json();
    },
    onSuccess: (ticket: any) => {
      toast({ title: "Ticket created", description: `Ticket #${ticket.id} has been submitted.` });
      setLocation(`/portal/tickets/${ticket.id}`);
    },
    onError: () => toast({ title: "Error", description: "Failed to create ticket.", variant: "destructive" }),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/portal/tickets")} className="gap-2 h-8">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <h1 className="text-xl font-bold text-[#394442] dark:text-white">New Ticket</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Submit a Support Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="summary" className="text-xs font-semibold">Summary <span className="text-red-500">*</span></Label>
            <Input id="summary" placeholder="Brief description of the issue" value={summary} onChange={e => setSummary(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">Details <span className="text-red-500">*</span></Label>
            <Textarea
              id="description"
              placeholder="Please provide as much detail as possible: what happened, when it started, any error messages, devices affected..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low — informational</SelectItem>
                <SelectItem value="Normal">Normal — standard request</SelectItem>
                <SelectItem value="High">High — impacts multiple users</SelectItem>
                <SelectItem value="Critical">Critical — business down</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => submit.mutate()}
            disabled={!summary.trim() || !description.trim() || submit.isPending}
            className="bg-[#E77125] hover:bg-[#E77125]/90 text-white w-full"
          >
            {submit.isPending ? "Submitting..." : "Submit Ticket"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
