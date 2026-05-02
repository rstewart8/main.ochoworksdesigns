import { Component, OnInit } from '@angular/core';
import { SEOService } from '../_services/seo.service';

@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.component.html',
  styleUrl: './about.component.css'
})
export class AboutComponent implements OnInit {
  constructor(private seoService: SEOService) {}

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'About OchoWorks Designs',
      description: 'Learn about OchoWorks Designs, a residential home design and drafting team with decades of design-build experience creating practical, permit-ready plans.',
      image: '/assets/images/randyjen.jpeg',
      url: 'https://ochoworksdesigns.com/about',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'About OchoWorks Designs',
        url: 'https://ochoworksdesigns.com/about',
        description: 'Residential design and drafting team creating custom home plans and construction-ready documentation.',
        isPartOf: {
          '@type': 'WebSite',
          name: 'OchoWorks Designs',
          url: 'https://ochoworksdesigns.com'
        }
      }
    });
  }
}
