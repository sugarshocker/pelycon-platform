import { Switch, Route } from "wouter";
import type { AuthUser } from "@/lib/queryClient";
import { ClientLayout } from "./ClientLayout";
import { ClientDashboard } from "./ClientDashboard";
import { Tickets } from "./Tickets";
import { TicketDetail } from "./TicketDetail";
import { NewTicket } from "./NewTicket";
import { Invoices } from "./Invoices";
import { Agreements } from "./Agreements";
import { SecurityDashboard } from "./SecurityDashboard";
import { AssetInventory } from "./AssetInventory";
import { TrendsAnalysis } from "./TrendsAnalysis";
import { KnowledgeBase } from "./KnowledgeBase";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export function ClientPortalApp({ user, onLogout }: Props) {
  return (
    <ClientLayout user={user} onLogout={onLogout}>
      <Switch>
        <Route path="/portal" component={ClientDashboard} />
        <Route path="/portal/tickets/new" component={NewTicket} />
        <Route path="/portal/tickets/:ticketId" component={TicketDetail} />
        <Route path="/portal/tickets" component={Tickets} />
        <Route path="/portal/invoices" component={Invoices} />
        <Route path="/portal/agreements" component={Agreements} />
        <Route path="/portal/security" component={SecurityDashboard} />
        <Route path="/portal/assets" component={AssetInventory} />
        <Route path="/portal/trends" component={TrendsAnalysis} />
        <Route path="/portal/kb" component={KnowledgeBase} />
        <Route>
          <ClientDashboard />
        </Route>
      </Switch>
    </ClientLayout>
  );
}
