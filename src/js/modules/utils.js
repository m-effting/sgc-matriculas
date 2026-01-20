/**
 * Calcula a data de entrega somando dias úteis (pula Sáb/Dom)
 * @param {number} businessDays - Dias úteis a adicionar
 * @returns {Date} Data final
 */
export function calculateDeadline(businessDays) {
    let date = new Date();
    let count = 0;
    
    while(count < businessDays) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay();
        // 0 = Domingo, 6 = Sábado
        if(day !== 0 && day !== 6) {
            count++;
        }
    }
    return date;
}

/**
 * Calcula dias úteis restantes até a data alvo
 * @param {string} deadlineStr - String de data ISO
 * @returns {number} Dias restantes (negativo se atrasado)
 */
export function getDaysLeft(deadlineStr) {
    if(!deadlineStr) return 0;
    
    const deadline = new Date(deadlineStr);
    const now = new Date();
    
    // Zerar horas para comparar apenas datas
    now.setHours(0,0,0,0);
    deadline.setHours(0,0,0,0);
    
    // Se já passou o prazo (Atrasado)
    if (deadline < now) {
        const diffTime = deadline - now;
        // Retorna dias corridos negativos
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Se está no prazo, conta dias úteis
    let count = 0;
    let current = new Date(now);
    
    while(current < deadline) {
        current.setDate(current.getDate() + 1);
        const day = current.getDay();
        if(day !== 0 && day !== 6) {
            count++;
        }
    }
    
    return count;
}
            