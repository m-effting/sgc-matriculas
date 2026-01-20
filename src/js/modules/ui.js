import { getDaysLeft } from './utils.js';

export function renderDashboard(tickets) {
    const grid = document.getElementById('dashboard-grid');
    const empty = document.getElementById('dashboard-empty');
    const active = tickets.filter(t => t.status !== 'resolvido');

    if (active.length === 0) {
        grid.innerHTML = '';
        grid.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    grid.classList.remove('hidden');

    grid.innerHTML = active.map(t => {
        const daysLeft = getDaysLeft(t.deadline_date);
        const isOverdue = daysLeft < 0;
        const badgeClass = isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700';
        const statusLabel = isOverdue ? 'Atrasado' : 'Em Andamento';
        const timeColor = isOverdue ? 'text-red-600' : (daysLeft <= 1 ? 'text-yellow-600' : 'text-blue-600');

        return `
        
${t.protocol}
${STATUSLABEL}
${t.requester}

${t.channel}

${daysLeft} dias úteis
visibility
check_circle
`;
    }).join('');
}

export function renderArchive(tickets, term = '') {
    const tbody = document.getElementById('archive-table-body');
    let list = tickets.filter(t => t.status === 'resolvido');

    if (term) {
        term = term.toLowerCase();
        list = list.filter(t => 
            t.protocol.toLowerCase().includes(term) || 
            t.requester.toLowerCase().includes(term) || 
            t.cpf.includes(term)
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = 'Nenhum registro encontrado.';
        return;
    }

    tbody.innerHTML = list.map(t => `
        
            ${t.protocol}
            ${t.requester}
${t.cpf}
            Resolvido
            ${t.resolution?.by || '-'}
            
                visibility
            
        
    `).join('');
}

export function updateStats(tickets) {
    const p = tickets.filter(t => t.status === 'pendente').length;
    const o = tickets.filter(t => t.status === 'atrasado').length;
    const elP = document.getElementById('stat-pending');
    const elO = document.getElementById('stat-overdue');
    if(elP) elP.innerText = p;
    if(elO) elO.innerText = o;
}
                    