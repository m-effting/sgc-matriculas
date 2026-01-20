import { db } from './modules/supabase.js';
import * as Tickets from './modules/tickets.js';
import * as UI from './modules/ui.js';

const app = {
    data: {
        tickets: [],
        currentView: 'dashboard', // dashboard, new, archive
        viewingId: null // ID do ticket sendo visualizado no modal
    },

    /**
     * Inicialização do App
     */
    async init() {
        console.log("Iniciando SGC Matrículas...");

        // 1. Verificar Sessão (Auth)

        const { data: { session } } = await db.auth.getSession();
        if (!session && window.location.pathname !== '/login.html') {
            window.location.href = '/login.html';
            return;
        }
        

        // 2. Carregar dados iniciais
        await this.fetchTickets();

        // 3. Configurar Realtime (Ouvir mudanças no banco)
        db.channel('mudancas-tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos' }, (payload) => {
                console.log('Mudança detectada no banco:', payload);
                this.fetchTickets(); // Recarrega a lista
            })
            .subscribe();

        // 4. Iniciar na tela padrão
        this.navigate('dashboard');
    },

    /**
     * Busca dados e atualiza a interface
     */
    async fetchTickets() {
        try {
            // Busca dados brutos do módulo Tickets
            this.data.tickets = await Tickets.getAllTickets();
            // Atualiza a tela atual
            this.refreshUI();
        } catch (error) {
            console.error("Erro fatal ao buscar tickets:", error);
        }
    },

    /**
     * Atualiza os elementos da tela baseados nos dados atuais
     */
    refreshUI() {
        // Atualiza contadores do dashboard
        UI.updateStats(this.data.tickets);

        // Renderiza a view ativa
        if(this.data.currentView === 'dashboard') {
            UI.renderDashboard(this.data.tickets);
        } else if(this.data.currentView === 'archive') {
            // Se tiver algo digitado na busca, mantém o filtro
            const searchVal = document.getElementById('search-input')?.value || '';
            UI.renderArchive(this.data.tickets, searchVal);
        }
    },

    /**
     * Navegação entre abas
     */
    navigate(viewId) {
        // Esconde todas as views
        ['view-dashboard', 'view-new', 'view-archive'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });

        // Mostra a view alvo
        const target = document.getElementById('view-' + viewId);
        if(target) target.classList.remove('hidden');
        
        // Atualiza estilo dos botões da sidebar
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('bg-blue-50', 'text-blue-600');
            el.classList.add('text-slate-600');
        });
        const activeBtn = document.getElementById('nav-' + viewId);
        if(activeBtn) {
            activeBtn.classList.add('bg-blue-50', 'text-blue-600');
            activeBtn.classList.remove('text-slate-600');
        }
        
        this.data.currentView = viewId;
        this.refreshUI();
    },

    /**
     * Ação: Criar Novo Atendimento
     */
    async createTicket(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerText = "Gerando...";

            // Chama o módulo Tickets para inserir no banco
            const { data, error } = await Tickets.createTicket(formData);
            
            if(error) throw error;

            alert('Protocolo gerado com sucesso!');
            form.reset();
            this.navigate('dashboard');
            this.fetchTickets();

        } catch (error) {
            console.error(error);
            alert('Erro ao criar atendimento: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Gerar Protocolo";
        }
    },

    /**
     * Ação: Abrir Modal de Detalhes
     * Preenche todos os campos com dados do ticket selecionado
     */
    openDetails(id) {
        this.data.viewingId = id;
        const t = this.data.tickets.find(x => x.id === id);
        
        if(!t) {
            console.error("Ticket não encontrado na memória local:", id);
            return;
        }

        // Helper para preencher texto com segurança
        const setText = (elementId, value) => {
            const el = document.getElementById(elementId);
            if(el) el.innerText = value || '-';
        };

        // Preencher Dados Básicos
        setText('det-protocol', t.protocol);
        setText('det-requester', t.requester);
        setText('det-cpf', t.cpf);
        setText('det-phone', t.phone);
        setText('det-channel', t.channel);
        setText('det-attendant', t.attendant);
        setText('det-deadline', (t.deadline_days || 0) + ' dias úteis');

        // Formatar Data de Criação
        if(t.created_at) {
            const date = new Date(t.created_at);
            setText('det-date', date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR').slice(0,5));
        }

        // Lógica do Status (Badge)
        const badge = document.getElementById('det-status');
        if(badge) {
            let label = 'Pendente';
            let cls = 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Default styles using Tailwind classes directly if needed, or map to CSS classes
            
            if(t.status === 'atrasado') {
                label = 'Atrasado';
                cls = 'bg-red-100 text-red-800 border-red-200';
            } else if(t.status === 'resolvido') {
                label = 'Resolvido';
                cls = 'bg-slate-100 text-slate-600 border-slate-200';
            }
            
            badge.innerText = label.toUpperCase();
            badge.className = `px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${cls}`;
        }

        // Descrição e Resolução
        let fullDescription = t.description || '';
        
        if (t.status === 'resolvido' && t.resolution) {
            // Se estiver resolvido, adiciona o bloco de resolução ao final da descrição
            const resDate = new Date(t.resolution.date).toLocaleString('pt-BR');
            fullDescription += `\n\n════════════════════════\n` +
                               `✅ CONCLUÍDO\n` +
                               `👤 Por: ${t.resolution.by}\n` +
                               `📅 Em: ${resDate}\n` +
                               `📝 Nota: ${t.resolution.notes || 'Sem observações'}`;
        }
        
        setText('det-description', fullDescription);
        
        // Mostrar Modal
        const modal = document.getElementById('modal-details');
        if(modal) modal.classList.remove('hidden');
    },

    /**
     * Ação: Excluir Atendimento
     */
    async deleteTicket() {
        if(!confirm('Tem certeza que deseja EXCLUIR permanentemente este atendimento?')) return;
        
        try {
            const { error } = await db.from('atendimentos').delete().eq('id', this.data.viewingId);
            
            if(error) throw error;
            
            // Sucesso
            document.getElementById('modal-details').classList.add('hidden');
            this.fetchTickets(); // Atualiza a lista
            
        } catch (error) {
            alert('Erro ao excluir: ' + error.message);
        }
    },

    /**
     * Ação: Preparar Modal de Resolução
     */
    openResolve(id) {
        this.data.viewingId = id;
        document.getElementById('res-id').value = id;
        document.getElementById('res-who').value = ''; // Limpar campo anterior
        document.getElementById('res-notes').value = ''; // Limpar campo anterior
        document.getElementById('modal-resolve').classList.remove('hidden');
    },

    /**
     * Ação: Confirmar Resolução
     */
    async confirmResolution() {
        const id = document.getElementById('res-id').value;
        const who = document.getElementById('res-who').value;
        const notes = document.getElementById('res-notes').value;

        if(!who) {
            alert('Por favor, informe quem resolveu o atendimento.');
            return;
        }

        try {
            const resolutionData = {
                by: who,
                notes: notes,
                date: new Date().toISOString()
            };

            const { error } = await db.from('atendimentos')
                .update({ 
                    status: 'resolvido', 
                    resolution: resolutionData 
                })
                .eq('id', id);

            if(error) throw error;

            // Sucesso
            document.getElementById('modal-resolve').classList.add('hidden');
            this.fetchTickets();

        } catch (error) {
            alert('Erro ao resolver: ' + error.message);
        }
    },

    /**
     * Utilitários
     */
    handleSearch(val) {
        // Redireciona a busca para o UI Module renderizar a tabela filtrada
        UI.renderArchive(this.data.tickets, val);
    },

    copy(text) {
        navigator.clipboard.writeText(text);
        alert('Protocolo copiado: ' + text);
    },
    
    maskCPF(el) {
        let v = el.value.replace(/\D/g,"");
        if(v.length > 11) v = v.slice(0,11);
        v = v.replace(/(\d{3})(\d)/,"$1.$2");
        v = v.replace(/(\d{3})(\d)/,"$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/,"$1-$2");
        el.value = v;
    },

    // Ação do botão "Sair" (Logout)
    async logout() {
        await db.auth.signOut();
        window.location.href = '/login.html';
    }
};

// EXPOR APP GLOBALMENTE
// Isso permite que o HTML acesse 'app.createTicket()', 'app.navigate()', etc.
window.app = app;

// INICIALIZAR QUANDO O DOM ESTIVER PRONTO
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
            