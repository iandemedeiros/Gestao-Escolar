import { AcademicHttp } from './academic.http.js';
const teacher = '123e4567-e89b-42d3-a456-426614174011',
  discipline = '123e4567-e89b-42d3-a456-426614174010';
describe('Academic HTTP mocked transport', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv(
      'INTERNAL_AUTH_TOKEN',
      'fictional-internal-token-for-tests-at-least-32-bytes',
    );
    vi.stubEnv('TURMAS_DISCIPLINAS_SERVICE_URL', 'http://127.0.0.1:3003');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it('forwards JWT and internal secret with context IDs only', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ allowed: true })),
    );
    const input = {
      turma_id: 1,
      disciplina_id: discipline,
      professor_id: teacher,
      titulo: 'private',
      peso: '1.25',
    };
    await new AcademicHttp().context(input, 'Bearer fixture');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.pathname).toBe('/internal/academic/context');
    expect(JSON.parse(options.body)).toEqual({
      turma_id: 1,
      disciplina_id: discipline,
      professor_id: teacher,
    });
    expect(options.headers.authorization).toBe('Bearer fixture');
    expect(options.headers['x-internal-auth-token']).toBe(
      process.env.INTERNAL_AUTH_TOKEN,
    );
    expect(options.redirect).toBe('error');
  });
  it('propagates missing references without driver details', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ private: 'secret' }), { status: 404 }),
    );
    await expect(
      new AcademicHttp().exists('alunos', teacher, 'Bearer fixture'),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('fails closed on malformed scope responses', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ contexts: [], aluno_ids: [], senha_hash: 'private' }),
      ),
    );
    await expect(new AcademicHttp().scope('Bearer fixture')).rejects.toThrow(
      'Integracao indisponivel.',
    );
  });
  it('sanitizes transport failures', async () => {
    fetchMock.mockRejectedValue(new Error('private URL'));
    await expect(
      new AcademicHttp().context(
        { turma_id: 1, disciplina_id: discipline },
        'Bearer fixture',
      ),
    ).rejects.toThrow('Integracao indisponivel.');
  });
});
