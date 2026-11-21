export interface GitHubRelease {
  version: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
}

export async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const res = await fetch('https://api.github.com/repos/Infuseting/launched/releases/latest', {
      next: { revalidate: 3600 }, // Cache successful release metadata for one hour.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`GitHub API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data: unknown = await res.json();
    if (
      !data ||
      typeof data !== 'object' ||
      !('tag_name' in data) ||
      typeof data.tag_name !== 'string' ||
      !('assets' in data) ||
      !Array.isArray(data.assets)
    )
      return null;
    const assets = data.assets.filter(
      (asset): asset is { name: string; browser_download_url: string } =>
        Boolean(asset) &&
        typeof asset === 'object' &&
        typeof asset.name === 'string' &&
        typeof asset.browser_download_url === 'string' &&
        asset.browser_download_url.startsWith('https://'),
    );
    return {
      version: data.tag_name,
      assets: assets.map((a) => ({
        name: a.name,
        browser_download_url: a.browser_download_url,
      })),
    };
  } catch (e) {
    console.error('Failed to fetch GitHub release', e);
    return null;
  }
}
