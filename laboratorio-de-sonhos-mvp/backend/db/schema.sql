-- Schema do "Registro do Laboratório de Sonhos"
-- Esquema do banco. Pode ser ajustado, mas a estrutura
-- de relacionamento e os vocabulários fechados (CHECK) não devem ser removidos.

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('coordenadora', 'educadora_voluntaria', 'administrador')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),  -- desativar em vez de excluir: sessões antigas referenciam quem registrou
  pin_hash TEXT,                                              -- só administradores têm PIN (scrypt com salt); nunca guardar PIN em texto
  pin_provisorio INTEGER NOT NULL DEFAULT 0 CHECK (pin_provisorio IN (0, 1)),  -- 1 = PIN inicial/redefinido, precisa ser trocado
  pode_exportar INTEGER NOT NULL DEFAULT 0 CHECK (pode_exportar IN (0, 1))     -- "quem exporta" (slide 11 do pitch); administrador sempre pode
);

CREATE TABLE IF NOT EXISTS turmas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  horario TEXT NOT NULL,
  tamanho_estimado INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS criancas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turma_id INTEGER NOT NULL REFERENCES turmas(id),
  nome_sintetico TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ciclos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  data_inicio TEXT NOT NULL,
  data_fim TEXT
);

CREATE TABLE IF NOT EXISTS sessoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turma_id INTEGER NOT NULL REFERENCES turmas(id),
  ciclo_id INTEGER NOT NULL REFERENCES ciclos(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  data TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('em_andamento', 'pausada', 'concluida')) DEFAULT 'em_andamento',
  exposicao_profissional TEXT,
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT,
  segundos_pausados INTEGER NOT NULL DEFAULT 0,
  tempo_total_segundos INTEGER
);

CREATE TABLE IF NOT EXISTS pausas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao_id INTEGER NOT NULL REFERENCES sessoes(id),
  pausada_em TEXT NOT NULL,
  retomada_em TEXT
);

CREATE TABLE IF NOT EXISTS registros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao_id INTEGER NOT NULL REFERENCES sessoes(id),
  crianca_id INTEGER NOT NULL REFERENCES criancas(id),
  aspiracao_categoria TEXT NOT NULL CHECK (aspiracao_categoria IN (
    'Professor(a)', 'Profissional de saúde', 'Policial/Bombeiro(a)',
    'Esporte profissional', 'Artista/Música', 'Tecnologia',
    'Empreendedor(a)/Comércio', 'Outra área de serviço público', 'Ainda não declarou'
  )),
  percurso_sim_nao INTEGER CHECK (percurso_sim_nao IN (0, 1)), -- NULL se aspiracao = 'Ainda não declarou'
  estado_observado TEXT CHECK (estado_observado IN (
    'Animada(o)', 'Concentrada(o)', 'Quieta(o)', 'Frustrada(o)', 'Não observado'
  )),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  editado_em TEXT,
  UNIQUE(sessao_id, crianca_id) -- um registro por criança por sessão; editar = UPDATE, não novo INSERT
);

CREATE INDEX IF NOT EXISTS idx_registros_sessao ON registros(sessao_id);
CREATE INDEX IF NOT EXISTS idx_registros_crianca ON registros(crianca_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_turma_ciclo ON sessoes(turma_id, ciclo_id);

-- Trilha de auditoria da administração (quem fez o quê e quando).
-- Nunca grava nome de criança: só ações, ids e nomes de equipe.
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),  -- NULL = ação automática do sistema (ex.: backup diário)
  acao TEXT NOT NULL,
  detalhe TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON auditoria(acao, criado_em);

-- Criança que não veio naquela sessão. Não é um "registro" (não tem aspiração): serve para
-- a pessoa poder ENCERRAR a sessão sem registrar todo mundo, e para a cobertura ser
-- calculada só sobre quem estava presente.
CREATE TABLE IF NOT EXISTS ausencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessao_id INTEGER NOT NULL REFERENCES sessoes(id),
  crianca_id INTEGER NOT NULL REFERENCES criancas(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(sessao_id, crianca_id)
);
CREATE INDEX IF NOT EXISTS idx_ausencias_sessao ON ausencias(sessao_id);
