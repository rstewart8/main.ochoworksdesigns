import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanSetComponent } from './plan-set.component';

describe('PlanSetComponent', () => {
  let component: PlanSetComponent;
  let fixture: ComponentFixture<PlanSetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanSetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanSetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
