
const app = {
    data: {
        tickets: [],
        currentView: 'dashboard',
        viewingId: null
    },

    async init() {
        console.log('Iniciando App...');
        await this.fetchTickets();
        
        // Habilita Realtime
        window.db.channel('mudancas-db')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos' }, payload => {
                console.log('Mudança detectada!', payload);
                this.fetchTickets(); // Recarrega tudo se alguém mudar algo
            })
            .subscribe();

        this.navigate('dashboard');
    },

    async fetchTickets() {
        // Busca dados do Supabase
        const { data, error } = await window.db.from('atendimentos').select('*');
        if (error) {
            console.error('Erro ao buscar:', error);
            alert('Erro ao conectar com banco de dados. Verifique o console.');
            return;
        }
        this.data.tickets = data || [];
        this.updateStats();
        if(this.data.currentView === 'dashboard') this.renderDashboard();
        if(this.data.currentView === 'archive') this.renderArchive();
    },

    navigate(viewId) {
        // Esconde todas as views
        ['view-dashboard', 'view-new', 'view-archive'].forEach(id => document.getElementById(id).classList.add('hidden'));
        document.getElementById('view-' + viewId).classList.remove('hidden');
        
        // Atualiza botões
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('bg-blue-50', 'text-blue-600');
            el.classList.add('text-slate-600');
        });
        const active = document.getElementById('nav-' + viewId);
        if(active) {
            active.classList.add('bg-blue-50', 'text-blue-600');
            active.classList.remove('text-slate-600');
        }
        
        this.data.currentView = viewId;
        if(viewId === 'dashboard') this.renderDashboard();
        if(viewId === 'archive') this.renderArchive();
    },

    async createTicket(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        
        // Dados para o banco
        const newTicket = {
            attendant: fd.get('attendant'),
            channel: fd.get('channel'),
            requester: fd.get('requester'),
            cpf: fd.get('cpf'),
            phone: fd.get('phone'),
            deadline_days: parseInt(fd.get('deadlineDays')),
            description: fd.get('description'),
            status: 'pendente',
            
            // Gera protocolo e datas
            protocol: 'SGC-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.floor(1000+Math.random()*9000),
            deadline_date: this.calculateDeadline(parseInt(fd.get('deadlineDays'))).toISOString()
        };

        const { error } = await window.db.from('atendimentos').insert([newTicket]);

        if(error) {
            alert('Erro ao criar: ' + error.message);
        } else {
            alert('Protocolo gerado: ' + newTicket.protocol);
            e.target.reset();
            this.navigate('dashboard');
            this.fetchTickets();
        }
    },

    calculateDeadline(days) {
        let date = new Date();
        let count = 0;
        while(count < days) {
            date.setDate(date.getDate() + 1);
            if(date.getDay() !== 0 && date.getDay() !== 6) count++;
        }
        return date;
    },

    renderDashboard() {
        const grid = document.getElementById('dashboard-grid');
        const empty = document.getElementById('dashboard-empty');
        const active = this.data.tickets.filter(t => t.status !== 'resolvido');
        
        if(active.length === 0) {
            grid.innerHTML = '';
            grid.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.classList.remove('hidden');

        grid.innerHTML = active.map(t => {
            const daysLeft = this.getDaysLeft(t.deadline_date);
            const isOverdue = daysLeft < 0;
            const badgeClass = isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700';
            const statusLabel = isOverdue ? 'Atrasado' : 'Em Andamento';
            const timeColor = isOverdue ? 'text-red-600' : (daysLeft <= 1 ? 'text-yellow-600' : 'text-blue-600');

            return `
            <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                <div class="flex justify-between mb-3">
                    <span class="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded cursor-pointer" onclick="navigator.clipboard.writeText('${t.protocol}')">${t.protocol}</span>
                    <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded ${badgeClass}">${statusLabel}</span>
                </div>
                <h3 class="font-bold truncate">${t.requester}</h3>
                <p class="text-xs text-slate-400 mb-3">${t.channel}</p>
                <div class="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span class="text-sm font-bold ${timeColor}">${daysLeft} dias úteis</span>
                    <div class="flex gap-2">
                        <button onclick="app.openDetails('${t.id}')" class="text-slate-400 hover:text-blue-600"><span class="material-symbols-outlined">visibility</span></button>
                        <button onclick="app.openResolve('${t.id}')" class="text-slate-400 hover:text-green-600"><span class="material-symbols-outlined">check_circle</span></button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    renderArchive(term = '') {
        const tbody = document.getElementById('archive-table-body');
        let list = this.data.tickets.filter(t => t.status === 'resolvido');
        
        if(term) {
            term = term.toLowerCase();
            list = list.filter(t => t.protocol.toLowerCase().includes(term) || t.requester.toLowerCase().includes(term) || t.cpf.includes(term));
        }

        if(list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Nada encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = list.map(t => `
            <tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="p-4 font-mono text-xs">${t.protocol}</td>
                <td class="p-4">${t.requester}<br><span class="text-xs text-slate-400">${t.cpf}</span></td>
                <td class="p-4"><span class="px-2 py-1 rounded-full text-xs bg-slate-100">Resolvido</span></td>
                <td class="p-4 text-sm">${t.resolution?.by || '-'}</td>
                <td class="p-4 text-right">
                    <button onclick="app.openDetails('${t.id}')" class="text-slate-400 hover:text-blue-600"><span class="material-symbols-outlined">visibility</span></button>
                </td>
            </tr>
        `).join('');
    },

    getDaysLeft(deadlineStr) {
        if(!deadlineStr) return 0;
        const deadline = new Date(deadlineStr);
        const now = new Date();
        now.setHours(0,0,0,0);
        deadline.setHours(0,0,0,0);
        
        // Simples cálculo de dias (para produção, use uma biblioteca de dias úteis real)
        const diff = deadline - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    },

    openDetails(id) {
        this.data.viewingId = id;
        const t = this.data.tickets.find(x => x.id === id);
        if(!t) return;

        // Preenche campos com IDs corretos (det-*)
        document.getElementById('det-protocol').innerText = t.protocol;
        document.getElementById('det-status').innerText = t.status.toUpperCase();
        document.getElementById('det-requester').innerText = t.requester;
        document.getElementById('det-cpf').innerText = t.cpf;
        document.getElementById('det-phone').innerText = t.phone || '-';
        document.getElementById('det-channel').innerText = t.channel;
        document.getElementById('det-attendant').innerText = t.attendant;
        document.getElementById('det-deadline').innerText = t.deadline_days + ' dias';
        
        let desc = t.description;
        if(t.resolution) {
            desc += `\n\n=== RESOLUÇÃO ===\nPor: ${t.resolution.by}\nObs: ${t.resolution.notes}`;
        }
        document.getElementById('det-description').innerText = desc;

        // Esconde botão de excluir se já resolvido (opcional, aqui deixei visivel)
        document.getElementById('modal-details').classList.remove('hidden');
    },

    openResolve(id) {
        this.data.viewingId = id;
        document.getElementById('res-id').value = id;
        document.getElementById('modal-resolve').classList.remove('hidden');
    },

    async confirmResolution() {
        const id = document.getElementById('res-id').value;
        const who = document.getElementById('res-who').value;
        const notes = document.getElementById('res-notes').value;

        if(!who) return alert('Diga quem resolveu!');

        const resolutionData = { by: who, notes: notes, date: new Date().toISOString() };
        
        const { error } = await window.db.from('atendimentos')
            .update({ status: 'resolvido', resolution: resolutionData })
            .eq('id', id);

        if(!error) {
            document.getElementById('modal-resolve').classList.add('hidden');
            this.fetchTickets();
        } else {
            alert('Erro ao resolver');
        }
    },

    async deleteTicket() {
        if(!confirm('Tem certeza?')) return;
        const { error } = await window.db.from('atendimentos').delete().eq('id', this.data.viewingId);
        if(!error) {
            document.getElementById('modal-details').classList.add('hidden');
            this.fetchTickets();
        }
    },

    handleSearch(val) {
        this.renderArchive(val);
    },

    updateStats() {
        const p = this.data.tickets.filter(t => t.status === 'pendente').length;
        const o = this.data.tickets.filter(t => t.status === 'atrasado').length;
        document.getElementById('stat-pending').innerText = p;
        document.getElementById('stat-overdue').innerText = o;
    },
    
    maskCPF(el) {
        let v = el.value.replace(/\D/g,"");
        if(v.length > 11) v = v.slice(0,11);
        v = v.replace(/(\d{3})(\d)/,"$1.$2");
        v = v.replace(/(\d{3})(\d)/,"$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/,"$1-$2");
        el.value = v;
    }
};

// Inicia
document.addEventListener('DOMContentLoaded', () => app.init());
