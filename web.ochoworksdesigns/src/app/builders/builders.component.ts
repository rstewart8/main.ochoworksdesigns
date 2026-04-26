import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SEOService } from '../_services/seo.service';

@Component({
  selector: 'app-builders',
  imports: [RouterModule],
  templateUrl: './builders.component.html',
  styleUrl: './builders.component.css'
})
export class BuildersComponent implements OnInit {
  constructor(private seoService: SEOService) {}

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'Home Builder & Contractor Drafting Services',
      description: 'Partner with OchoWorks Designs for construction-ready home plan sets, plan modifications, custom designs, and drafting support for builders and contractors.',
      image: '/assets/images/custom-home-rendering-3.jpg',
      url: 'https://ochoworksdesigns.com/home-builders',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Home Builder and Contractor Drafting Services',
        provider: {
          '@type': 'Organization',
          name: 'OchoWorks Designs',
          url: 'https://ochoworksdesigns.com'
        },
        areaServed: 'United States',
        serviceType: 'Residential architectural design and drafting',
        url: 'https://ochoworksdesigns.com/home-builders',
        description: 'Construction-ready plan sets, plan modifications, custom home design, and drafting support for builders and contractors.'
      }
    });
  }
}
