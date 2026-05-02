import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SEOService } from '../_services/seo.service';

@Component({
  selector: 'app-owner-builders',
  imports: [RouterModule],
  templateUrl: './owner-builders.component.html',
  styleUrl: '../custom-home-design/custom-home-design.component.css'
})
export class OwnerBuildersComponent implements OnInit {
  constructor(private seoService: SEOService) {}

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'Future Homeowner House Plans',
      description: 'Future homeowner house plans from OchoWorks Designs help you create clear, construction-ready drawings to build yourself or take to a contractor.',
      image: '/assets/images/featured-plans/mountain-modern-plan-1071.jpg',
      url: 'https://ochoworksdesigns.com/future-homeowners',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Future Homeowner House Plans',
        provider: {
          '@type': 'Organization',
          name: 'OchoWorks Designs',
          url: 'https://ochoworksdesigns.com'
        },
        serviceType: 'Future homeowner residential drafting',
        url: 'https://ochoworksdesigns.com/future-homeowners'
      }
    });
  }
}
