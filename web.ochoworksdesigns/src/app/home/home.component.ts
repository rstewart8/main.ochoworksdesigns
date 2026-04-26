import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SEOService } from '../_services/seo.service';

@Component({
  selector: 'app-home',
  imports: [RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  constructor(private seoService: SEOService) {}

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'Custom Home Design & Drafting Services',
      description: 'OchoWorks Designs creates custom home plans, featured house plans, and construction-ready drafting packages for homeowners, builders, and contractors.',
      image: '/assets/images/custom-home-rendering-2.jpg',
      url: 'https://ochoworksdesigns.com/home',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'OchoWorks Designs',
        url: 'https://ochoworksdesigns.com',
        description: 'Custom home design and drafting services for homeowners, builders, and contractors.',
        publisher: {
          '@type': 'Organization',
          name: 'OchoWorks Designs',
          url: 'https://ochoworksdesigns.com',
          logo: 'https://ochoworksdesigns.com/assets/images/8-logo.png'
        }
      }
    });
  }
}
