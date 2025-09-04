import { initFileProvider, parseHttp } from '../../../test/testUtils';

describe('SQL Plugin', () => {
  initFileProvider();

  it('should parse SQL method syntax', async () => {
    const httpFile = await parseHttp(`
    SQL postgresql://user:pass@localhost:5432/testdb
    SELECT * FROM users;
    `);

    expect(httpFile.httpRegions).toHaveLength(1);
    const httpRegion = httpFile.httpRegions[0];
    expect(httpRegion.request).toBeDefined();
    expect(httpRegion.request?.protocol).toBe('SQL');
    expect(httpRegion.request?.url).toBe('postgresql://user:pass@localhost:5432/testdb');
    expect(httpRegion.request?.method).toBe('SQL');
  });

  it('should parse postgresql:// protocol syntax', async () => {
    const httpFile = await parseHttp(`
    postgresql://user:pass@localhost:5432/testdb
    SELECT * FROM users WHERE id = 1;
    `);

    expect(httpFile.httpRegions).toHaveLength(1);
    const httpRegion = httpFile.httpRegions[0];
    expect(httpRegion.request).toBeDefined();
    expect(httpRegion.request?.protocol).toBe('SQL');
    expect(httpRegion.request?.url).toBe('postgresql://user:pass@localhost:5432/testdb');
    expect(httpRegion.request?.method).toBe('SQL');
  });

  it('should parse SQL body', async () => {
    const httpFile = await parseHttp(`
    SQL postgresql://user:pass@localhost:5432/testdb

    SELECT id, name, email FROM users WHERE active = true ORDER BY created_at DESC;
    `);

    expect(httpFile.httpRegions).toHaveLength(1);
    const httpRegion = httpFile.httpRegions[0];
    expect(httpRegion.request).toBeDefined();
    expect(httpRegion.request?.body).toContain('SELECT id, name, email FROM users WHERE active = true ORDER BY created_at DESC');
  });

  it('should not parse non-SQL lines', async () => {
    const httpFile = await parseHttp(`
    GET https://api.example.com
    `);

    expect(httpFile.httpRegions).toHaveLength(1);
    const httpRegion = httpFile.httpRegions[0];
    expect(httpRegion.request).toBeDefined();
    expect(httpRegion.request?.protocol).toBe('HTTP');
    expect(httpRegion.request?.method).toBe('GET');
  });
});