// Vocabulários FECHADOS (Regra 3: nenhum texto livre sobre comportamento/emoção da criança).
// Os mesmos valores estão nos CHECK do schema.sql; aqui servem para validar ANTES de chegar
// ao banco e devolver uma mensagem clara (antes, um valor fora da lista virava um erro enganoso).
const SEM_DECLARACAO = 'Ainda não declarou';

const CATEGORIAS = [
  'Professor(a)', 'Profissional de saúde', 'Policial/Bombeiro(a)', 'Esporte profissional',
  'Artista/Música', 'Tecnologia', 'Empreendedor(a)/Comércio', 'Outra área de serviço público',
  SEM_DECLARACAO
];
const ESTADOS = ['Animada(o)', 'Concentrada(o)', 'Quieta(o)', 'Frustrada(o)', 'Não observado'];
const EXPOSICOES = ['Educador(a) responsável', 'Oficina externa convidada', 'Atividade em dupla de educadores'];

module.exports = { SEM_DECLARACAO, CATEGORIAS, ESTADOS, EXPOSICOES };
