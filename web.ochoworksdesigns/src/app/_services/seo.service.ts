import { Injectable, Inject, PLATFORM_ID, ComponentFactoryResolver } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { BlogPost } from './blog.service';

export interface SEOData {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  schema?: any;
  section?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SEOService {
  private isBrowser: boolean;
  private readonly baseUrl = 'https://ochoworksdesigns.com';
  private readonly defaultImage = '/assets/images/8-logo.png';
  private readonly siteName = 'OchoWorks Designs';

  constructor(
    private meta: Meta,
    private title: Title,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  updateSEO(data: SEOData): void {
    // Update title
    if (data.title) {
      this.title.setTitle(`${data.title} | ${this.siteName}`);
      this.meta.updateTag({ property: 'og:title', content: data.title });
      this.meta.updateTag({ name: 'twitter:title', content: data.title });
    }

    // Update description
    if (data.description) {
      this.meta.updateTag({ name: 'description', content: data.description });
      this.meta.updateTag({ property: 'og:description', content: data.description });
      this.meta.updateTag({ name: 'twitter:description', content: data.description });
    }

    // Update keywords
    if (data.keywords) {
      this.meta.updateTag({ name: 'keywords', content: data.keywords });
    }

    // Update canonical URL
    const url = data.url || this.getCurrentUrl();
    this.meta.updateTag({ rel: 'canonical', href: url });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:url', content: url });

    // Update image
    const image = data.image ? this.getFullImageUrl(data.image) : this.getFullImageUrl(this.defaultImage);
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:image', content: image });
    this.meta.updateTag({ property: 'og:image:width', content: '1200' });
    this.meta.updateTag({ property: 'og:image:height', content: '630' });

    // Update Open Graph type
    this.meta.updateTag({ property: 'og:type', content: data.type || 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: this.siteName });

    // Update Twitter Card
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:site', content: '@ochoworksdesigns' });

    // Update author
    if (data.author) {
      this.meta.updateTag({ name: 'author', content: data.author });
      this.meta.updateTag({ property: 'article:author', content: data.author });
    }

    // Update publish/modified times
    if (data.publishedTime) {
      this.meta.updateTag({ property: 'article:published_time', content: data.publishedTime });
    }

    if (data.modifiedTime) {
      this.meta.updateTag({ property: 'article:modified_time', content: data.modifiedTime });
    }

    // Update tags
    if (data.tags && data.tags.length > 0) {
      // Remove existing tags
      this.meta.removeTag('property="article:tag"');
      // Add new tags
      data.tags.forEach(tag => {
        this.meta.addTag({ property: 'article:tag', content: tag });
      });
    }

    // Update structured data
    if (data.schema) {
      this.updateStructuredData(data.schema);
    }
  }

  updateBlogPostSEO(post: BlogPost): void {
    const seoData: SEOData = {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      keywords: post.meta_keywords || (post.tags ? post.tags.join(', ') : ''),
      image: post.featured_image,
      url: `${this.baseUrl}/blog/${post.slug}`,
      type: 'article',
      author: post.author,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      tags: post.tags,
      schema: this.generateBlogPostSchema(post)
    };

    this.updateSEO(seoData);
  }

  updateBlogListSEO(): void {
    const seoData: SEOData = {
      title: 'Blog - House Plans & Home Design Inspiration',
      description: 'Discover home design tips, house plan ideas, and architectural insights from OchoWorks Designs. Get inspired for your dream home project.',
      keywords: 'home design, house plans, architecture, design inspiration, home building tips',
      url: `${this.baseUrl}/blog`,
      type: 'website',
      schema: this.generateBlogListSchema()
    };

    this.updateSEO(seoData);
  }

  private generateBlogPostSchema(post: BlogPost): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      image: post.featured_image ? this.getFullImageUrl(post.featured_image) : this.getFullImageUrl(this.defaultImage),
      author: {
        '@type': 'Person',
        name: post.author,
        url: `${this.baseUrl}/about`
      },
      publisher: {
        '@type': 'Organization',
        name: this.siteName,
        logo: {
          '@type': 'ImageObject',
          url: this.getFullImageUrl(this.defaultImage),
          width: 300,
          height: 300
        }
      },
      datePublished: post.published_at,
      dateModified: post.updated_at,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${this.baseUrl}/blog/${post.slug}`
      },
      keywords: post.tags ? post.tags.join(', ') : '',
      wordCount: this.calculateWordCount(post.content),
      timeRequired: `PT${post.read_time || this.calculateReadTime(post.content)}M`,
      url: `${this.baseUrl}/blog/${post.slug}`
    };
  }

  private generateBlogListSchema(): any {
    return {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `${this.siteName} Blog`,
      description: 'House plans, home design tips, and architectural insights',
      url: `${this.baseUrl}/blog`,
      publisher: {
        '@type': 'Organization',
        name: this.siteName,
        logo: {
          '@type': 'ImageObject',
          url: this.getFullImageUrl(this.defaultImage),
          width: 300,
          height: 300
        }
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${this.baseUrl}/blog`
      }
    };
  }

  private updateStructuredData(schema: any): void {
    if (!this.isBrowser) return;

    // Remove existing structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  private getCurrentUrl(): string {
    return `${this.baseUrl}${this.router.url}`;
  }

  private getFullImageUrl(imagePath: string): string {
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    return `${this.baseUrl}${imagePath.startsWith('/') ? imagePath : '/' + imagePath}`;
  }

  private calculateWordCount(content: string): number {
    //// Handle undefined or empty content
    if (!content) return 0;
    //// Split content by whitespace and filter out empty strings
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.calculateWordCount(content);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  // Method to clean up meta tags (useful for SPA routing)
  clearSEO(): void {
    // Clear article-specific tags
    this.meta.removeTag('property="article:author"');
    this.meta.removeTag('property="article:published_time"');
    this.meta.removeTag('property="article:modified_time"');
    this.meta.removeTag('property="article:tag"');
    
    // Remove structured data
    if (this.isBrowser) {
      const existingScript = document.querySelector('script[type="application/ld+json"]');
      if (existingScript) {
        existingScript.remove();
      }
    }
  }

  // Method to generate sitemap data (if needed for dynamic sitemap generation)
  generateSitemapEntry(url: string, lastmod?: string, changefreq?: string, priority?: string): any {
    return {
      loc: url,
      lastmod: lastmod || new Date().toISOString().split('T')[0],
      changefreq: changefreq || 'weekly',
      priority: priority || '0.8'
    };
  }
}