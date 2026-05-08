describe('jest sanity', () => {
  it('arithmetic still works', () => {
    expect(1 + 1).toBe(2);
  });

  it('async assertions work', async () => {
    await expect(Promise.resolve('ok')).resolves.toBe('ok');
  });
});
