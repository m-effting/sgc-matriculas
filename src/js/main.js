import { db } from './modules/supabase.js';
import * as Tickets from './modules/tickets.js';
import * as UI from './modules/ui.js';
import * as Avisos from './modules/avisos.js';

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
        avisos: [],
        currentView: 'dashboard', // dashboard, new, archive, avisos
        viewingId: null,          // ID do ticket sendo visualizado
        viewingAvisoId: null      // ID do aviso sendo visualizado/editado
    },

    // guarda info do usuário atual (populado no init)
    _currentUserId: null,
    _isAdmin: false,

    /**
     * Inicialização do App
     */
    async init() {
        console.log("Iniciando SGC Matrículas...");

        const path = window.location.pathname || '/';
        const hash = window.location.hash || '';
        const isLoginPath = (
            path.includes('login') ||
            hash.includes('login') ||
            !!document.getElementById('login-form')
        );

        // 1. Verificar Sessão
        try {
            // Get session and user
            const { data: sessionData } = await db.auth.getSession();
            const session = sessionData ? sessionData.session : null;

            const { data: userData } = await db.auth.getUser();
            const user = userData?.user ?? null;
            this._currentUserId = user?.id ?? null;
            // tenta detectar role 
            this._isAdmin = (user?.app_metadata?.role === 'admin') || (user?.user_metadata?.role === 'admin') || false;

            if (!session && !isLoginPath) {
                window.location.href = '/login.html';
                return;
            }

            if (session && isLoginPath) {
                window.location.href = '/index.html';
                return;
            }

        } catch (e) {
            console.error('Erro ao verificar sessão:', e);
            if (!isLoginPath) {
                window.location.href = '/login.html';
                return;
            }
        }

        if (isLoginPath) {
            // registra handler de login 
            return;
        }

        // registra listener do form de avisos
        const avisosForm = document.getElementById('form-aviso');
        if (avisosForm) {
            avisosForm.addEventListener('submit', (e) => this.saveAviso(e));
        }

        // registra listener do form de edição de tickets
        const editTicketForm = document.getElementById('form-edit-ticket');
        if (editTicketForm) {
            editTicketForm.addEventListener('submit', (e) => this.saveEditTicket(e));
        }

        // 2. Carregar dados iniciais
        await Promise.all([this.fetchTickets(), this.fetchAvisos()]);

        // 3. Configurar Realtime
        db.channel('mudancas-tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos' }, () => this.fetchTickets())
            .subscribe();

        db.channel('mudancas-avisos')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, () => this.fetchAvisos())
            .subscribe();

        // 4. Iniciar na tela padrão
        this.navigate('dashboard');
    },

    /**
     * Atualiza a UI (central)
     */
    refreshUI() {
        // atualiza contadores
        UI.updateStats(this.data.tickets);

        // render por view
        if (this.data.currentView === 'dashboard') {
            // Atualizado para passar usuário e admin para controle de permissões
            UI.renderDashboard(this.data.tickets, this._currentUserId, this._isAdmin);
        } else if (this.data.currentView === 'archive') {
            const searchVal = document.getElementById('search-input')?.value || '';
            UI.renderArchive(this.data.tickets, searchVal);
        } else if (this.data.currentView === 'avisos') {
            UI.renderAvisos(this.data.avisos, this._currentUserId, this._isAdmin);
        }
    },

    /**
     * Tickets (Agora busca usernames também)
     */
    async fetchTickets() {
        try {
            // 1. Busca tickets
            let tickets = await Tickets.getAllTickets();

            // 2. Coleta IDs únicos de quem criou
            const userIds = [...new Set(tickets.map(t => t.created_by).filter(Boolean))];

            // 3. Busca profiles para pegar o username
            let profileMap = {};
            if (userIds.length > 0) {
                const { data: profiles, error: profileError } = await db
                    .from('profiles')
                    .select('id, username')
                    .in('id', userIds);
                
                if (!profileError && profiles) {
                    profiles.forEach(p => {
                        profileMap[p.id] = p.username;
                    });
                }
            }

            // 4. Mapeia username no ticket
            this.data.tickets = tickets.map(t => ({
                ...t,
                username: profileMap[t.created_by] || 'Sistema Local'
            }));

            this.refreshUI();
        } catch (error) {
            console.error("Erro fatal ao buscar tickets:", error);
        }
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

    addStudent() {
        const container = document.getElementById('students-container');
        const seriesOpts = SERIES_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');
        const zoneOpts = ZONEAMENTO_OPTIONS.map(z => `<option value="${z}">${z}</option>`).join('');
        const studentHtml = `
            <div class="p-3 border border-slate-200 rounded-lg bg-slate-50 relative student-item animate-fade-in group hover:border-slate-300 transition-colors">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aluno</span>
                    <button type="button" onclick="this.closest('.student-item').remove()" class="text-slate-400 hover:text-red-500 transition-colors p-1" title="Remover aluno">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
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

    // --- Adicionar Aluno no Modal de Edição  ---
    addEditStudent(data = null) {
        const container = document.getElementById('edit-students-container');
        const seriesOpts = SERIES_OPTIONS.map(s => 
            `<option value="${s}" ${data && data.grade === s ? 'selected' : ''}>${s}</option>`
        ).join('');
        const zoneOpts = ZONEAMENTO_OPTIONS.map(z => 
            `<option value="${z}" ${data && data.zone === z ? 'selected' : ''}>${z}</option>`
        ).join('');

        const valName = data ? data.name : '';

        // Botão de fechar em linha separada
        const studentHtml = `
            <div class="p-3 border border-slate-200 rounded-lg bg-slate-50 relative edit-student-item group hover:border-slate-300 transition-colors">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aluno</span>
                    <button type="button" onclick="this.closest('.edit-student-item').remove()" class="text-slate-400 hover:text-red-500 transition-colors p-1" title="Remover aluno">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
                <div class="grid grid-cols-1 gap-3">
                    <input class="input-field bg-white edit-student-name" placeholder="Nome do Aluno" value="${valName}" required>
                    <div class="grid grid-cols-2 gap-3">
                        <select class="input-field bg-white edit-student-grade" required>
                            <option value="" disabled ${!data ? 'selected' : ''}>Série</option>
                            ${seriesOpts}
                        </select>
                        <select class="input-field bg-white edit-student-zone" required>
                            <option value="" disabled ${!data ? 'selected' : ''}>Zoneamento</option>
                            ${zoneOpts}
                        </select>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', studentHtml);
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
                    <li class="flex items-start gap-3 text-slate-700 bg-white p-2 rounded border border-slate-100">
                        <div class="bg-blue-50 text-blue-600 rounded p-1">
                            <span class="material-symbols-outlined text-sm block">school</span>
                        </div>
                        <div>
                            <div class="font-medium text-sm">${s.name}</div>
                            <div class="text-[11px] text-slate-500 uppercase tracking-wide">${s.grade} • ${s.zone}</div>
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

        // --- Geração do HTML de Metadados ---
        const metaContainer = document.getElementById('det-meta-info');
        const descContent = document.getElementById('det-desc-content');
        const resolutionContainer = document.getElementById('det-resolution-info');
        
        // Data e Criador 
        let createdDate = t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : '-';
        let metaHtml = `
            <div class="flex items-center gap-4 text-xs text-slate-500 pb-3 mb-3 border-b border-slate-100">
                <div class="flex items-center gap-1.5" title="Criado por">
                    <span class="material-symbols-outlined text-sm text-slate-400">person</span>
                    <span class="font-semibold text-slate-700">${t.username || 'Desconhecido'}</span>
                </div>
                <div class="flex items-center gap-1.5" title="Data de Criação">
                    <span class="material-symbols-outlined text-sm text-slate-400">calendar_month</span>
                    <span>${createdDate}</span>
                </div>
            </div>
        `;

        if (metaContainer) metaContainer.innerHTML = metaHtml;
        if (descContent) descContent.innerText = t.description || 'Sem descrição.';

        // --- Geração do HTML de Resolução  ---
        let resolutionHtml = '';
        if (t.status === 'resolvido' && t.resolution) {
            const resDate = new Date(t.resolution.date).toLocaleString('pt-BR');
            resolutionHtml = `
                <div class="bg-green-50 border border-green-100 rounded-lg p-3">
                    <div class="flex items-center gap-2 mb-2 text-green-800 font-bold text-sm">
                        <span class="material-symbols-outlined text-base">check_circle</span>
                        Concluído
                    </div>
                    <div class="text-xs text-green-700 space-y-1">
                        <div class="flex gap-1"><span class="font-semibold">Por:</span> ${t.resolution.by}</div>
                        <div class="flex gap-1"><span class="font-semibold">Em:</span> ${resDate}</div>
                        ${t.resolution.notes ? `<div class="mt-2 pt-2 border-t border-green-200/50"><span class="font-semibold block mb-1">Resolução:</span> ${t.resolution.notes}</div>` : ''}
                    </div>
                </div>
            `;
        } else if (t.status === 'cancelado') {
             resolutionHtml = `
                <div class="bg-slate-100 border border-slate-200 rounded-lg p-3 flex items-center gap-2 text-slate-600 font-bold text-sm">
                    <span class="material-symbols-outlined text-base">cancel</span>
                    Atendimento Cancelado
                </div>
            `;
        }

        if (resolutionContainer) {
            resolutionContainer.innerHTML = resolutionHtml;
            // Se houver conteúdo, mostra e adiciona espaçamento superior. Se não, esconde.
            if (resolutionHtml) {
                resolutionContainer.classList.remove('hidden');
                resolutionContainer.classList.add('mt-4', 'pt-4', 'border-t', 'border-slate-100');
            } else {
                resolutionContainer.classList.add('hidden');
                resolutionContainer.classList.remove('mt-4', 'pt-4', 'border-t', 'border-slate-100');
            }
        }

        // Badge de Status
        const badge = document.getElementById('det-status');
        if(badge) {
            let cls = 'bg-yellow-100 text-yellow-800 border-yellow-200';
            if(t.status === 'atrasado') cls = 'bg-red-100 text-red-800 border-red-200';
            if(t.status === 'resolvido') cls = 'bg-slate-100 text-slate-600 border-slate-200';
            if(t.status === 'cancelado') cls = 'bg-slate-800 text-white border-slate-600';

            badge.innerText = t.status.toUpperCase();
            badge.className = `px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${cls}`;
        }

        // --- LÓGICA DE BOTÕES DO RODAPÉ (Editar e Excluir) ---
        const actionsDiv = document.getElementById('det-actions');
        const isArchived = t.status === 'resolvido' || t.status === 'cancelado';
        const isOwner = t.created_by === this._currentUserId;
        const canEdit = !isArchived && (isOwner || this._isAdmin);
        const canDelete = isArchived ? this._isAdmin : (isOwner || this._isAdmin);

        actionsDiv.innerHTML = `
            ${canEdit ? `
                <button onclick="app.openEditTicket('${t.id}')" class="text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-transparent hover:border-blue-100">
                    <span class="material-symbols-outlined text-lg">edit</span> Editar
                </button>
            ` : ''}
            
            ${canDelete ? `
                <button onclick="app.deleteTicket()" class="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors border border-transparent hover:border-red-100">
                    <span class="material-symbols-outlined text-lg">delete</span> Excluir
                </button>
            ` : ''}
            
            <button onclick="document.getElementById('modal-details').classList.add('hidden')" class="ml-auto bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors shadow-sm">Fechar</button>
        `;

        const modal = document.getElementById('modal-details');
        if(modal) modal.classList.remove('hidden');
    },

    // --- Abrir Modal de Edição de Ticket ---
    openEditTicket(id) {
        document.getElementById('modal-details').classList.add('hidden');

        const ticket = this.data.tickets.find(t => t.id === id);
        if(!ticket) return;

        document.getElementById('edit-ticket-id').value = ticket.id;
        document.getElementById('edit-attendant').value = ticket.attendant || '';
        document.getElementById('edit-channel').value = ticket.channel || '';
        document.getElementById('edit-requester').value = ticket.requester || '';
        document.getElementById('edit-cpf').value = ticket.cpf || '';
        document.getElementById('edit-phone').value = ticket.phone || '';
        document.getElementById('edit-deadline').value = ticket.deadline_days || '3';
        document.getElementById('edit-description').value = ticket.description || '';

        const container = document.getElementById('edit-students-container');
        container.innerHTML = ''; 

        if (ticket.students && Array.isArray(ticket.students)) {
            ticket.students.forEach(s => this.addEditStudent(s));
        }

        document.getElementById('modal-edit-ticket').classList.remove('hidden');
    },

    // --- Salvar Edição de Ticket ---
    async saveEditTicket(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const id = document.getElementById('edit-ticket-id').value;

        try {
            submitBtn.disabled = true;
            submitBtn.innerText = "Salvando...";

            const studentContainer = document.getElementById('edit-students-container');
            const studentRows = studentContainer.querySelectorAll('.edit-student-item');
            const students = [];

            studentRows.forEach(row => {
                const name = row.querySelector('.edit-student-name').value.trim();
                const grade = row.querySelector('.edit-student-grade').value;
                const zone = row.querySelector('.edit-student-zone').value;
                
                if (name) {
                    students.push({ name, grade, zone });
                }
            });

            const updates = {
                attendant: document.getElementById('edit-attendant').value,
                channel: document.getElementById('edit-channel').value,
                requester: document.getElementById('edit-requester').value,
                cpf: document.getElementById('edit-cpf').value,
                phone: document.getElementById('edit-phone').value,
                deadline_days: document.getElementById('edit-deadline').value,
                description: document.getElementById('edit-description').value,
                students: students 
            };

            await Tickets.updateTicket(id, updates);
            
            document.getElementById('modal-edit-ticket').classList.add('hidden');
            this.fetchTickets();
            
        } catch (error) {
            console.error(error);
            alert('Erro ao atualizar ticket: ' + (error.message || JSON.stringify(error)));
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Salvar Alterações";
        }
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
            const resolutionData = { by: who, notes: notes, date: new Date().toISOString() };
            const { error } = await db.from('atendimentos')
                .update({ status: 'resolvido', resolution: resolutionData })
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
    },

    navigate(viewId) {
        ['view-dashboard', 'view-new', 'view-archive', 'view-avisos'].forEach(id => {
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

    /**
     * Avisos
     */
    async fetchAvisos() {
        try {
            this.data.avisos = await Avisos.getAllAvisos();
            
            // Garantir informações de usuário atualizadas
            const { data: userData } = await db.auth.getUser();
            const user = userData?.user ?? null;
            this._currentUserId = user?.id ?? this._currentUserId;
            this._isAdmin = (user?.app_metadata?.role === 'admin') || (user?.user_metadata?.role === 'admin') || this._isAdmin;

            UI.renderAvisos(this.data.avisos, this._currentUserId, this._isAdmin);
        } catch (error) {
            console.error("Erro ao buscar avisos:", error);
        }
    },

    async saveAviso(e) {
        e.preventDefault();
        const form = document.getElementById('form-aviso');
        if (!form) return;

        const id = document.getElementById('aviso-id').value;
        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            submitBtn.disabled = true;
            submitBtn.innerText = "Salvando...";

            const avisoData = {
                title: document.getElementById('aviso-title').value.trim(),
                content: document.getElementById('aviso-content').value.trim(),
                pinned: document.getElementById('aviso-pinned').checked || false
            };

            if (id) {
                // Modo Edição
                await Avisos.updateAviso(id, avisoData);
            } else {
                // Modo Criação
                await Avisos.createAviso(avisoData);
            }

            form.reset();
            document.getElementById('modal-avisos').classList.add('hidden');
            this.fetchAvisos();
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar aviso: ' + (error.message || JSON.stringify(error)));
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Salvar";
        }
    },

    openCreateAviso() {
        const form = document.getElementById('form-aviso');
        if (form) {
            form.reset();
            document.getElementById('modal-avisos-title').innerText = 'Novo Aviso';
            document.getElementById('aviso-id').value = ''; 
            document.getElementById('modal-avisos').classList.remove('hidden');
        }
    },

    openEditAviso(id) {
        const aviso = this.data.avisos.find(a => a.id == id);
        
        if(!aviso) {
            console.error('Aviso não encontrado para o ID:', id);
            return;
        }

        const form = document.getElementById('form-aviso');
        if (!form) return;

        // Preenche o formulário
        document.getElementById('aviso-id').value = aviso.id || '';
        document.getElementById('aviso-title').value = aviso.title || '';
        document.getElementById('aviso-content').value = aviso.content || '';
        document.getElementById('aviso-pinned').checked = !!aviso.pinned;

        document.getElementById('modal-avisos-title').innerText = 'Editar Aviso';
        document.getElementById('modal-avisos').classList.remove('hidden');
    },

    async deleteAviso(id) {
        if(!confirm('Deseja realmente excluir este aviso?')) return;
        try {
            await Avisos.deleteAviso(id);
            this.fetchAvisos();
        } catch (error) {
            alert('Erro ao excluir aviso: ' + (error.message || JSON.stringify(error)));
        }
    }
};

window.app = app;
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});