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
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (!res.ok) {
      console.error(`GitHub API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    return {
      version: data.tag_name,
      assets: data.assets.map((a: any) => ({
        name: a.name,
        browser_download_url: a.browser_download_url
      }))
    };
  } catch (e) {
    console.error('Failed to fetch GitHub release', e);
    return null;
  }
}
