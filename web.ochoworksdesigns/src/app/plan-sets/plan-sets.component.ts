import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SEOService } from '../_services/seo.service';

@Component({
  selector: 'app-plan-sets',
  imports: [RouterModule],
  templateUrl: './plan-sets.component.html',
  styleUrl: '../custom-home-design/custom-home-design.component.css'
})
export class PlanSetsComponent implements OnInit {
  constructor(private seoService: SEOService) {}

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'Construction-Ready House Plan Sets',
      description: 'Construction-ready house plan sets from OchoWorks Designs include drawings for site planning, foundations, framing, elevations, electrical layouts, roofs, and wall sections.',
      image: '/assets/images/featured-plans/modern-farmhouse-plan-1075-main-floor.png',
      url: 'https://ochoworksdesigns.com/construction-ready-plan-sets',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: 'Construction-Ready House Plan Sets',
        provider: {
          '@type': 'Organization',
          name: 'OchoWorks Designs',
          url: 'https://ochoworksdesigns.com'
        },
        serviceType: 'Residential construction plan sets',
        url: 'https://ochoworksdesigns.com/construction-ready-plan-sets'
      }
    });
  }
}
