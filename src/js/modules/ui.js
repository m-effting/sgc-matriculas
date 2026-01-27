import { getDaysLeft } from './utils.js';

export function renderDashboard(tickets) {
    const grid = document.getElementById('dashboard-grid');
    const empty = document.getElementById('dashboard-empty');

    // Filtra apenas o que não está resolvido ou cancelado
    const active = tickets.filter(t => t.status !== 'resolvido' && t.status !== 'cancelado');

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

        const badgeClass = isOverdue
            ? 'bg-red-100 text-red-700 border-red-200'
            : 'bg-blue-50 text-blue-700 border-blue-200';

        const statusLabel = isOverdue ? 'Atrasado' : (t.status === 'em_andamento' ? 'Em Andamento' : t.status);
        const timeColor = isOverdue ? 'text-red-600' : (daysLeft <= 1 ? 'text-yellow-600' : 'text-blue-600');

        // Indicador visual se tiver alunos vinculados
        const studentsCount = t.students && Array.isArray(t.students) ? t.students.length : 0;
        const studentIcon = studentsCount > 0 
            ? `<div class="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                 <span class="material-symbols-outlined text-[14px]">school</span> ${studentsCount} aluno(s)
               </div>` 
            : '';

        return `
        <div class="bg-white rounded-xl shadow-sm border p-4 flex flex-col gap-3">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <div class="text-sm text-slate-400">Protocolo</div>
                    <div class="font-bold text-lg">${t.protocol}</div>
                </div>
                <div class="text-right">
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${badgeClass}">
                        ${statusLabel.toUpperCase()}
                    </span>
                </div>
            </div>

            <div class="text-sm text-slate-600">
                <div class="font-medium">${t.requester}</div>
                <div class="text-xs">${t.cpf || ''} • ${t.phone || ''}</div>
            </div>

            ${studentIcon ? `<div class="flex">${studentIcon}</div>` : ''}

            <div class="flex items-center justify-between text-sm mt-auto pt-2 border-t border-slate-50">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-slate-400">call</span>
                    <span>${t.channel}</span>
                </div>
                <div class="text-right">
                    <div class="${timeColor} font-bold">${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'dia' : 'dias'}</div>
                    <div class="text-xs text-slate-400">até o prazo</div>
                </div>
            </div>

            <div class="flex justify-end gap-2 mt-2">
                <button onclick="app.openDetails('${t.id}')" class="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200">
                    <span class="material-symbols-outlined align-middle">visibility</span>
                </button>
                <button onclick="app.openResolve('${t.id}')" class="px-3 py-1 text-sm rounded bg-green-50 hover:bg-green-100">
                    <span class="material-symbols-outlined align-middle">check_circle</span>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

export function renderArchive(tickets, term = '') {
    const tbody = document.getElementById('archive-table-body');
    let list = tickets.filter(t => t.status === 'resolvido' || t.status === 'cancelado');

    if (term) {
        term = term.toLowerCase();
        list = list.filter(t =>
            (t.protocol || '').toLowerCase().includes(term) ||
            (t.requester || '').toLowerCase().includes(term) ||
            (t.cpf || '').includes(term)
        );
    }

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-sm text-slate-500">Nenhum registro encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(t => {
        const statusLabel = (t.status || '').toUpperCase();
        const resolvedBy = t.resolution?.by || '-';
        const resolvedAt = t.resolution?.date ? new Date(t.resolution.date).toLocaleDateString('pt-BR') : '-';

        return `
        <tr class="border-b hover:bg-slate-50 transition-colors">
            <td class="p-4 font-medium">${t.protocol}</td>
            <td class="p-4">${t.requester}</td>
            <td class="p-4 uppercase text-sm">${statusLabel}</td>
            <td class="p-4">${resolvedBy}</td>
            <td class="p-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <div class="text-xs text-slate-500 mr-4">${resolvedAt}</div>
                    <button onclick="app.openDetails('${t.id}')" class="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200">
                        <span class="material-symbols-outlined">visibility</span>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

export function updateStats(tickets) {
    const p = tickets.filter(t => t.status === 'pendente' || t.status === 'em_andamento').length;
    const now = new Date();
    const o = tickets.filter(t => {
        if(t.status === 'resolvido' || t.status === 'cancelado') return false;
        return new Date(t.deadline_date) < now;
    }).length;

    const elP = document.getElementById('stat-pending');
    const elO = document.getElementById('stat-overdue');
    if(elP) elP.innerText = p;
    if(elO) elO.innerText = o;
}

export function renderAvisos(avisos, currentUserId, isAdmin = false) {
    const container = document.getElementById('avisos-list');
    if (!container) return;

    if (!avisos || avisos.length === 0) {
        container.innerHTML = '<div class="p-6 bg-white rounded border text-slate-500">Nenhum aviso encontrado.</div>';
        return;
    }

    container.innerHTML = avisos.map(a => {
        const pinnedLabel = a.pinned ? '<span class="text-xs font-bold text-white bg-blue-600 px-2 py-0.5 rounded">FIXO</span>' : '';
        const canEdit = (a.created_by === currentUserId) || isAdmin;

        return `
        <div class="bg-white rounded-xl shadow-sm border p-4">
          <div class="flex justify-between items-start gap-4">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold">${a.title}</h3>
                ${pinnedLabel}
              </div>
              <div class="text-xs text-slate-500">${a.created_by_email || '—'} • ${new Date(a.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <div class="flex gap-2">
              ${canEdit ? `<button onclick="app.openEditAviso('${a.id}')" class="px-3 py-1 text-sm rounded bg-slate-100 hover:bg-slate-200">Editar</button>` : ''}
              ${isAdmin ? `<button onclick="app.deleteAviso('${a.id}')" class="px-3 py-1 text-sm rounded text-red-600 hover:bg-red-50">Excluir</button>` : ''}
            </div>
          </div>
          <div class="mt-3 text-sm text-slate-700 whitespace-pre-wrap">${a.content || ''}</div>
        </div>
        `;
    }).join('');
}