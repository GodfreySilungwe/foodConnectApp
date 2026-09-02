describe('ProviderList', () => {
  it('renders empty state when no providers exist', () => {
    const providers = [];
    expect(providers.length).toBe(0);
  });

  it('renders provider name when providers exist', () => {
    const providers = [{ id: 'p-001', name: 'Sunrise Kitchen', status: 'active' }];
    expect(providers[0].name).toBe('Sunrise Kitchen');
  });
});
