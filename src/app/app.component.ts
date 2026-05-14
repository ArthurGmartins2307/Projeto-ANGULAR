import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/** 
 * =========================================================================
 * 🔴 ATENÇÃO: COLOQUE AQUI AS CREDENCIAIS DO SEU BANCO DE DADOS SUPABASE
 * =========================================================================
 */
const SUPABASE_URL = 'https://nqsqepsyaaplcvwvibxp.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xc3FlcHN5YWFwbGN2d3ZpYnhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzM3MzMsImV4cCI6MjA5NDMwOTczM30.ql5FCeA24koqaGNT9d7ke_NuxOoAIBgD9uUJTp1jVkA';

/**
 * =========================================================================
 * 🔑 DEFINA QUAIS E-MAILS SERÃO ADMINISTRADORES AQUI
 * Qualquer outro e-mail não listado aqui será um Usuário Comum.
 * =========================================================================
 */
const ADMIN_EMAILS = [
  'arthurgmgalvao@gmail.com',
  'noaheana@gmail.com',
];

class SupabaseConnection {
  
  private sessionToken: string | null = null;
  public userId: string | null = null;
  
  setSession(token: string, userId: string) {
    this.sessionToken = token;
    this.userId = userId;
  }
  
  private getHeaders(useAuth = false) {
    const headers: any = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    if (useAuth && this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    } else {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
    }
    return headers;
  }
  
  async login(email: string, password: string): Promise<{error?: string, token?: string, userId?: string}> {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) return { error: data.error_description || data.msg || 'Erro de credenciais' };
      
      this.setSession(data.access_token, data.user.id);
      return { token: data.access_token, userId: data.user.id };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async register(email: string, password: string): Promise<{error?: string, success?: boolean}> {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) return { error: data.error_description || data.msg || 'Erro ao registrar' };
      
      if (data.session) {
        this.setSession(data.session.access_token, data.user.id);
      }
      return { success: true };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async getTickets(isAdmin: boolean): Promise<Ticket[]> {
    try {
      let url = `${SUPABASE_URL}/rest/v1/tickets?order=created_at.desc`;
      if (!isAdmin && this.userId) {
        url += `&user_id=eq.${this.userId}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(true)
      });
      if (!response.ok) throw new Error('Erro na conexão com banco de dados.');
      return await response.json();
    } catch (error) {
      console.error(error);
      return []; 
    }
  }

  async insertTicket(ticket: Partial<Ticket>): Promise<any> {
    try {
      if (!ticket.user_id && this.userId) ticket.user_id = this.userId;

      await fetch(`${SUPABASE_URL}/rest/v1/tickets`, {
        method: 'POST',
        headers: this.getHeaders(true),
        body: JSON.stringify(ticket)
      });
    } catch (error) {
      console.error('Erro ao inserir', error);
    }
  }

  async updateTicket(id: number, status: string): Promise<any> {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/tickets?id=eq.${id}`, {
        method: 'PATCH',
        headers: this.getHeaders(true),
        body: JSON.stringify({ status })
      });
    } catch (error) {
      console.error('Erro ao atualizar', error);
    }
  }
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  created_at: string;
  user_id?: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  
  db = new SupabaseConnection();
  
  isAuthenticated = false;
  isAdmin = false;
  
  isRegistering = false;
  authEmail = '';
  authPassword = '';
  authError = '';
  isAuthLoading = false;

  currentView = 'dashboard';

  tickets: Ticket[] = [];
  isLoading: boolean = false;
  
  showNewTicketForm: boolean = false;
  newTicketTitle: string = '';
  newTicketDesc: string = '';
  newTicketPriority: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  
  async ngOnInit() { }

  async doLogin() {
    this.authError = '';
    if (!this.authEmail || !this.authPassword) {
      this.authError = 'Preencha email e senha.';
      return;
    }
    
    this.isAuthLoading = true;
    const res = await this.db.login(this.authEmail, this.authPassword);
    this.isAuthLoading = false;
    
    if (res.error) {
      this.authError = res.error;
    } else {
      this.handleSuccessLogin();
    }
  }

  async doRegister() {
    this.authError = '';
    if (!this.authEmail || !this.authPassword) {
      this.authError = 'Preencha email e senha.';
      return;
    }
    
    this.isAuthLoading = true;
    const res = await this.db.register(this.authEmail, this.authPassword);
    
    if (res.error) {
      this.isAuthLoading = false;
      this.authError = res.error;
    } else {
      const loginRes = await this.db.login(this.authEmail, this.authPassword);
      this.isAuthLoading = false;
      
      if (loginRes.error) {
        this.authError = 'Registrado, mas não pôde logar: ' + loginRes.error;
      } else {
        this.handleSuccessLogin();
      }
    }
  }

  private handleSuccessLogin() {
    this.isAuthenticated = true;
    this.isAdmin = ADMIN_EMAILS.includes(this.authEmail.toLowerCase());
    this.loadTickets();
  }

  logout() {
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.tickets = [];
    this.db.setSession('', '');
    this.authEmail = '';
    this.authPassword = '';
    this.changeView('dashboard');
  }

  changeView(view: string) {
    this.currentView = view;
    if (view === 'dashboard' || view === 'my_tickets') {
      this.loadTickets();
    }
  }

  async loadTickets() {
    this.isLoading = true;
    this.tickets = await this.db.getTickets(this.isAdmin);
    this.isLoading = false;
  }

  async createTicket() {
    if (!this.newTicketTitle || !this.newTicketDesc) return;
    
    this.isLoading = true;
    
    await this.db.insertTicket({
      title: this.newTicketTitle,
      description: this.newTicketDesc,
      status: 'OPEN',
      priority: this.newTicketPriority,
      created_at: new Date().toISOString()
    });
    
    this.newTicketTitle = '';
    this.newTicketDesc = '';
    this.newTicketPriority = 'LOW';
    this.showNewTicketForm = false;
    
    await this.loadTickets();
  }

  async updateStatus(ticket: Ticket, newStatus: string) {
    this.isLoading = true;
    ticket.status = newStatus as any; 
    await this.db.updateTicket(ticket.id, newStatus);
    await this.loadTickets();
  }

  get totalTickets() { return this.tickets.length; }
  get openTickets() { return this.tickets.filter(t => t.status === 'OPEN').length; }
  get resolvedTickets() { return this.tickets.filter(t => t.status === 'RESOLVED').length; }
  
  get filteredTickets() {
    if (this.currentView === 'my_tickets') {
      return this.tickets.filter(t => t.status !== 'RESOLVED');
    }
    return this.tickets;
  }

  getStatusLabel(status: string) {
    const map: Record<string, string> = {
      'OPEN': 'Aberto',
      'IN_PROGRESS': 'Em Atendimento',
      'RESOLVED': 'Resolvido'
    };
    return map[status] || status;
  }
  
  getPriorityLabel(priority: string) {
    const map: Record<string, string> = {
      'LOW': 'Baixa',
      'MEDIUM': 'Média',
      'HIGH': 'Crítica'
    };
    return map[priority] || priority;
  }
  
  openForm() {
    this.showNewTicketForm = true;
  }
  
  closeForm() {
    this.showNewTicketForm = false;
  }
}
