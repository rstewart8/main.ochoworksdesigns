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
      title: 'General Contractor & Developer Drafting Services',
      description: 'Partner with OchoWorks Designs for construction-ready home plan sets, plan modifications, custom designs, and drafting support for general contractors and developers.',
      image: '/assets/images/featured-plans/mountain-modern-plan-1071.jpg',
      url: 'https://ochoworksdesigns.com/general-contractors-developers',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'General Contractor and Developer Drafting Services',
        provider: {
          '@type': 'Organization',
          name: 'OchoWorks Designs',
          url: 'https://ochoworksdesigns.com'
        },
        areaServed: 'United States',
        serviceType: 'Residential architectural design and drafting',
        url: 'https://ochoworksdesigns.com/general-contractors-developers',
        description: 'Construction-ready plan sets, plan modifications, custom home design, and drafting support for general contractors and developers.'
      }
    });
  }
}
