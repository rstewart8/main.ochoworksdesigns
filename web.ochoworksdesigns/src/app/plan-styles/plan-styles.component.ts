import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SEOService } from '../_services/seo.service';

@Component({
  selector: 'app-plan-styles',
  imports: [CommonModule, RouterModule],
  templateUrl: './plan-styles.component.html',
  styleUrl: '../custom-home-design/custom-home-design.component.css'
})
export class PlanStylesComponent implements OnInit {
  styles = [
    'Modern Farmhouse', 'Craftsman', 'Ranch', 'Mountain Homes', 'Lakefront Properties',
    'Traditional', 'Contemporary', 'Single Story', 'Two Story', 'Basement Plans',
    'Large Garages', 'Barndominium', 'Energy Efficient', 'Multi-Generational'
  ];

  constructor(private seoService: SEOService) {}

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'House Plan Styles',
      description: 'Explore house plan styles from OchoWorks Designs, including modern farmhouse, craftsman, ranch, mountain homes, basement plans, large garages, and custom designs.',
      image: '/assets/images/featured-plans/santa-fe-plan-1080.jpg',
      url: 'https://ochoworksdesigns.com/house-plan-styles',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'House Plan Styles',
        url: 'https://ochoworksdesigns.com/house-plan-styles',
        description: 'Residential house plan styles and custom design categories from OchoWorks Designs.'
      }
    });
  }
}
