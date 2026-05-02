import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SEOService } from '../_services/seo.service';

@Component({
  selector: 'app-plan-modifications',
  imports: [RouterModule],
  templateUrl: './plan-modifications.component.html',
  styleUrl: '../custom-home-design/custom-home-design.component.css'
})
export class PlanModificationsComponent implements OnInit {
  constructor(private seoService: SEOService) {}

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'House Plan Modification Services',
      description: 'Modify an existing house plan with OchoWorks Designs. Adjust layouts, garages, basements, elevations, and lot-specific details for a buildable plan.',
      image: '/assets/images/featured-plans/modern-farmhouse-plan-1075-main-floor.png',
      url: 'https://ochoworksdesigns.com/plan-modifications',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'House Plan Modification Services',
        provider: {
          '@type': 'Organization',
          name: 'OchoWorks Designs',
          url: 'https://ochoworksdesigns.com'
        },
        serviceType: 'House plan modifications',
        url: 'https://ochoworksdesigns.com/plan-modifications'
      }
    });
  }
}
