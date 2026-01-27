import { db } from './modules/supabase.js';
import * as Tickets from './modules/tickets.js';
import * as UI from './modules/ui.js';

// Definições de constantes para uso nos Selects
const SERIES_OPTIONS = [
    "GT1", "GT2", "GT3", "GT4", "GT5",
    "1º ANO", "2º ANO", "3º ANO", "4º ANO", "5º ANO",
    "6º ANO", "7º ANO", "8º ANO", "9º ANO"
];

const ZONEAMENTO_OPTIONS = [
    "Aririú/Alto Aririú",
    "Aririú da Formiga",
    "Barra do Aririú/Rio Grande/Pacheco/Centro",
    "Bela vista",
    "Brejarú/Jardim Eldorado",
    "Caminho Novo/Madri",
    "Enseada do Brito",
    "Frei Damião",
    "Furadinho Praia de Fora",
    "Guarda do Cubatão",
    "Pagani/Passa Vinte",
    "Ponte do Imaruim",
    "São Sebastião",
    "Rincão/Morretes/ Guarda do Embaú",
    "Albradão/ Três Barras/Sertão do Campo",
    "Pinheira/Ponta do Papagaio/Pasagem do Maciambu"
];

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

        // 1. Verificar Sessão (Auth) - uso seguro de getSession()
        try {
            const { data } = await db.auth.getSession();
            const session = data ? data.session : null;

            // Se não há sessão, envia para login (a não ser que já esteja na página de login)
            if (!session && window.location.pathname !== '/login.html') {
                window.location.href = '/login.html';
                return;
            }
        } catch (e) {
            console.error('Erro ao verificar sessão:', e);
            // Em caso de erro técnico, melhor redirecionar para login
            if (window.location.pathname !== '/login.html') {
                window.location.href = '/login.html';
                return;
            }
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
            this.data.tickets = await Tickets.getAllTickets();
            this.refreshUI();
        } catch (error) {
            console.error("Erro fatal ao buscar tickets:", error);
        }
    },

    /**
     * Atualiza os elementos da tela baseados nos dados atuais
     */
    refreshUI() {
        UI.updateStats(this.data.tickets);

        if(this.data.currentView === 'dashboard') {
            UI.renderDashboard(this.data.tickets);
        } else if(this.data.currentView === 'archive') {
            const searchVal = document.getElementById('search-input')?.value || '';
            UI.renderArchive(this.data.tickets, searchVal);
        }
    },

    navigate(viewId) {
        ['view-dashboard', 'view-new', 'view-archive'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });

        const target = document.getElementById('view-' + viewId);
        if(target) target.classList.remove('hidden');

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

    addStudent() {
        const container = document.getElementById('students-container');
        const seriesOpts = SERIES_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
        const zoneOpts = ZONEAMENTO_OPTIONS.map(z => `<option value="${z}">${z}</option>`).join('');

        const studentHtml = `
            <div class="p-4 border border-slate-200 rounded-lg bg-slate-50 relative student-item animate-fade-in">
                <button type="button" onclick="this.parentElement.remove()" class="absolute top-2 right-2 text-slate-400 hover:text-red-500" title="Remover aluno">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input name="student_name[]" placeholder="Nome do Aluno" class="input-field bg-white" required>
                    <select name="student_grade[]" class="input-field bg-white" required>
                        <option value="" disabled selected>Série</option>
                        ${seriesOpts}
                    </select>
                    <select name="student_zone[]" class="input-field bg-white" required>
                        <option value="" disabled selected>Zoneamento</option>
                        ${zoneOpts}
                    </select>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', studentHtml);
    },

    async createTicket(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            submitBtn.disabled = true;
            submitBtn.innerText = "Gerando...";

            const { data, error } = await Tickets.createTicket(formData);
            if (error) throw error;

            alert('Protocolo gerado com sucesso!');
            form.reset();
            document.getElementById('students-container').innerHTML = '';

            this.navigate('dashboard');
            this.fetchTickets();

        } catch (error) {
            console.error(error);
            alert('Erro ao criar atendimento: ' + (error.message || JSON.stringify(error)));
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Gerar Protocolo";
        }
    },

    openDetails(id) {
        this.data.viewingId = id;
        const t = this.data.tickets.find(x => x.id === id);
        if(!t) return;

        const setText = (elementId, value) => {
            const el = document.getElementById(elementId);
            if(el) el.innerText = value || '-';
        };

        setText('det-protocol', t.protocol);
        setText('det-requester', t.requester);
        setText('det-cpf', t.cpf);
        setText('det-phone', t.phone);
        setText('det-channel', t.channel);
        setText('det-attendant', t.attendant);
        setText('det-deadline', (t.deadline_days || 0) + ' dias úteis');

        const studentsContainer = document.getElementById('det-students');
        if (studentsContainer) {
            if (t.students && Array.isArray(t.students) && t.students.length > 0) {
                const listHtml = t.students.map(s => `
                    <li class="flex items-start gap-2 text-slate-700">
                        <span class="material-symbols-outlined text-slate-400 text-sm mt-0.5">person</span>
                        <div>
                            <div class="font-medium">${s.name}</div>
                            <div class="text-xs text-slate-500">${s.grade} • ${s.zone}</div>
                        </div>
                    </li>
                `).join('');
                studentsContainer.innerHTML = `<ul class="space-y-2 bg-slate-50 p-3 rounded border border-slate-100">${listHtml}</ul>`;
                studentsContainer.parentElement.classList.remove('hidden');
            } else {
                studentsContainer.innerHTML = '';
                studentsContainer.parentElement.classList.add('hidden');
            }
        }

        let fullDesc = `📧 Criado por: ${t.created_by_email || 'Desconhecido'}\n\n`;
        fullDesc += t.description || '';

        if(t.created_at) {
            const date = new Date(t.created_at);
            setText('det-date', date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR').slice(0,5));
        }

        const badge = document.getElementById('det-status');
        if(badge) {
            let cls = 'bg-yellow-100 text-yellow-800 border-yellow-200';
            if(t.status === 'atrasado') cls = 'bg-red-100 text-red-800 border-red-200';
            if(t.status === 'resolvido') cls = 'bg-slate-100 text-slate-600 border-slate-200';

            badge.innerText = t.status.toUpperCase();
            badge.className = `px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${cls}`;
        }

        if (t.status === 'resolvido' && t.resolution) {
            const resDate = new Date(t.resolution.date).toLocaleString('pt-BR');
            fullDesc += `\n\n════════════════════════\n` +
                        `✅ CONCLUÍDO\n` +
                        `👤 Por: ${t.resolution.by}\n` +
                        `📅 Em: ${resDate}\n` +
                        `📝 Nota: ${t.resolution.notes || 'Sem observações'}`;
        }

        setText('det-description', fullDesc);

        const modal = document.getElementById('modal-details');
        if(modal) modal.classList.remove('hidden');
    },

    async deleteTicket() {
        if(!confirm('Tem certeza que deseja EXCLUIR permanentemente este atendimento?')) return;

        try {
            const { error } = await db.from('atendimentos').delete().eq('id', this.data.viewingId);
            if(error) throw error;

            document.getElementById('modal-details').classList.add('hidden');
            this.fetchTickets();

        } catch (error) {
            alert('Erro ao excluir: ' + (error.message || JSON.stringify(error)));
        }
    },

    openResolve(id) {
        this.data.viewingId = id;
        document.getElementById('res-id').value = id;
        document.getElementById('res-who').value = '';
        document.getElementById('res-notes').value = '';
        document.getElementById('modal-resolve').classList.remove('hidden');
    },

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

            document.getElementById('modal-resolve').classList.add('hidden');
            this.fetchTickets();

        } catch (error) {
            alert('Erro ao resolver: ' + (error.message || JSON.stringify(error)));
        }
    },

    handleSearch(val) {
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

    async logout() {
        await db.auth.signOut();
        window.location.href = '/login.html';
    }
};

window.app = app;

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
