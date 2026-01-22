SGC - Sistema de Gerenciamento e Controle

O SGC é a ferramenta oficial utilizada pelo Setor Central de Matrículas da Secretaria de Educação para a gestão de atendimentos variados. O sistema foca na eficiência operacional, na transparência dos processos e no cumprimento de prazos administrativos.

Contexto e Utilização

O sistema centraliza as demandas do público recebidas por diversos canais, permitindo que a equipe monitore o volume de chamados e gerencie pendências de naturezas distintas. É um recurso essencial para a rotina administrativa e para manter um histórico confiável dos serviços prestados à comunidade escolar.

Especificações Técnicas

A interface é construída com HTML5, Tailwind CSS e JavaScript (ES6+ Modules), utilizando WebSockets para sincronização em tempo real. A infraestrutura de backend é baseada em Supabase e PostgreSQL, com autenticação via Supabase Auth.

Segurança e Dados

A integridade é garantida pelo Row Level Security (RLS) diretamente no banco de dados. Servidores autenticados podem visualizar a listagem, mas as operações de escrita e edição são restritas para evitar alterações não autorizadas. Os atendimentos são classificados entre os estados Pendente, Em Andamento, Resolvido ou Cancelado.

Instalação e Execução

Para rodar o projeto localmente, realize a clonagem do repositório, configure as credenciais no arquivo src/js/modules/supabase.js e execute o arquivo index.html através de um servidor local.