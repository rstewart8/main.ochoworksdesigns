import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SEOService } from '../_services/seo.service';

@Component({
  selector: 'app-custom-home-design',
  imports: [RouterModule],
  templateUrl: './custom-home-design.component.html',
  styleUrl: './custom-home-design.component.css'
})
export class CustomHomeDesignComponent implements OnInit {
  constructor(private seoService: SEOService) {}

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'Custom Home Design Services',
      description: 'Custom home design and residential drafting services from OchoWorks Designs. Turn sketches, ideas, lots, or inspiration into construction-ready house plans.',
      image: '/assets/images/featured-plans/modern-farmhouse-plan-1075.jpg',
      url: 'https://ochoworksdesigns.com/custom-home-design',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Custom Home Design Services',
        provider: {
          '@type': 'Organization',
          name: 'OchoWorks Designs',
          url: 'https://ochoworksdesigns.com'
        },
        serviceType: 'Custom residential home design and drafting',
        url: 'https://ochoworksdesigns.com/custom-home-design',
        description: 'Custom home plans, residential drafting, and construction-ready plan sets for future homeowners, general contractors, and developers.'
      }
    });
  }
}
