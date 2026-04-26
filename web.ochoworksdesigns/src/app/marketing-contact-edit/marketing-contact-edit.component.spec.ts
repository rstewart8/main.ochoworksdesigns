import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingContactEditComponent } from './marketing-contact-edit.component';

describe('MarketingContactEditComponent', () => {
  let component: MarketingContactEditComponent;
  let fixture: ComponentFixture<MarketingContactEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingContactEditComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingContactEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
