import {
  peekFares,
  offPeekFares,
  dailyCapLimits,
  weeklyCapLimits,
  peekHours,
} from "./rules/FareDetails";

import GroupingHelper from "./GroupingHelper";

/**
 * Jouney type for input object
 **/
interface Journey {
  dateTime: Date;
  from: number;
  to: number;
}

/**
 * Fare type for output daily and weekly fares
 **/
interface Fare {
  date: string;
  fare: number;
  maxZone: Array<number>;
}

/**
 * Grouped daily and weekly fares
 **/
interface WeekJourney {
  day: string;
  dailyJourney: Journey[];
}

/**
 * A class for Fare calculation and the required methods
 **/
class FareCalculation {
  // class variables to use across functions
  weekMaxZone: Array<number> = [2, 2];
  weekTotalFare: number = 0;
  weekCapReached: boolean = false;

  /**
   * Calculates the journey fare for each day
   *
   * @param {object} inputJourneyData Input file data to process.
   * @returns {Fare[]} Fare calculated for all the days in the input
   */
  calculateFares = (inputJourneyData: object): Fare[] | Error => {
    const listJourney: Journey[] = Object.values(inputJourneyData).map(
      (j: Journey) => {
        return { ...j, dateTime: new Date(j.dateTime) }; // Casting to Date field
      }
    );

    // Input validation - Error handling
    // Tests if the date-time is valid, zone numbers(from and to) are numbers
    const invalideJourneyInputs = listJourney.filter((e) => {
      return !this._isValidDate(e.dateTime) || isNaN(e.from) || isNaN(e.to);
    });

    // Returns error is invalid
    if (invalideJourneyInputs.length)
      return new Error("Invalid inputs, provide correct inputs");

    const groupingHelper = new GroupingHelper();

    // 1. Grouping by day to calculate each day fare and apply limit
    const journeyByDate: Map<string, Journey[]> =
      groupingHelper.groupJourneyByDate(listJourney);

    let dayJourneyGroup = new Array<WeekJourney>();
    for (let [day, singleDayTrips] of journeyByDate) {
      dayJourneyGroup.push({ day: day, dailyJourney: singleDayTrips });
    }

    // 2. Grouping by week to calculate each week fare and apply limit
    const weekJourneyGroup: Map<string, WeekJourney[]> =
      groupingHelper.groupJourneyByWeek(dayJourneyGroup);

    let singleTripFares = new Array<Fare>();
    for (let [, weekJourney] of weekJourneyGroup) {
      // Compute each week

      // 3. Find max zones for the week
      const flatWeekDays = weekJourney.flatMap((i) => i.dailyJourney);
      this.weekMaxZone = this._findMaxZone(flatWeekDays);

      this.weekTotalFare = 0;
      this.weekCapReached = false;

      for (let dayJourneys of weekJourney) {
        // Compute each day where key is "dayJourneys.day"
        singleTripFares.push(
          ...this._findEachTripFare(dayJourneys.dailyJourney)
        );
      }
    }

    return singleTripFares;
  };

  /**
   * Calculate each trip fare and limit it to 0 if the daily cap is reached or
   * the weekly cap is reached based on zone
   *
   * @param {Journey[]} singleDayTrips Single day trips aggregated by date
   * @returns {Fare[]} singleDayFares Fares calculated for each trip
   */
  _findEachTripFare = (singleDayTrips: Journey[]): Fare[] => {
    // Find maxzone for the day
    let dayMaxZone = this._findMaxZone(singleDayTrips);

    // Find caps for the max zones
    const maxWeeklyCap =
      weeklyCapLimits[this.weekMaxZone[0]][this.weekMaxZone[1]];
    const maxDailyCap = dailyCapLimits[dayMaxZone[0]][dayMaxZone[1]];

    let dayTotalFare: number = 0,
      dayCapReached: boolean = false;

    let singleTripFares = new Array<Fare>();
    for (const sj of singleDayTrips) {
      // 4. Calculate single trip with capping limits, peek hours, weekday/weekends factors
      let sjFare = this._calculateSingleTripFare(sj);

      // Check for week cap limit first and then day cap
      if (this.weekCapReached || dayCapReached) {
        sjFare = 0;
      } else if (maxWeeklyCap < this.weekTotalFare + sjFare) {
        sjFare = maxWeeklyCap - this.weekTotalFare;
        this.weekCapReached = true;
      } else if (maxWeeklyCap == this.weekTotalFare + sjFare) {
        sjFare = 0;
        this.weekCapReached = true;
      } else if (maxDailyCap < dayTotalFare + sjFare) {
        sjFare = maxDailyCap - dayTotalFare;
        dayCapReached = true;
      } else if (maxDailyCap == dayTotalFare + sjFare) {
        sjFare = 0;
        dayCapReached = true;
      }

      // 5. Push the fares calculated for each trip
      singleTripFares.push({
        date:
          sj.dateTime.toDateString() + " " + sj.dateTime.toLocaleTimeString(),
        fare: sjFare,
        maxZone: this.weekMaxZone, // Week zone limit as it is of high priority
      });

      // Accumulate fares for capping
      dayTotalFare = Math.min(maxDailyCap, dayTotalFare + sjFare);
      this.weekTotalFare = Math.min(maxWeeklyCap, this.weekTotalFare + sjFare);
    }

    return singleTripFares;
  };

  /**
   * Find the max cap limit zone travelled for a week or day
   * @param {Journey[]} journeys Journeys for a week or day
   * @returns {Array<number>} Maximum or farthest zones travelled
   */
  _findMaxZone(journeys: Journey[]): Array<number> {
    let maxZone = [2, 2];
    for (const j of journeys) {
      if (j.from !== j.to) {
        maxZone = [j.from, j.to];
        break;
      } else if (j.from == 1) {
        maxZone = [j.from, j.to];
      }
    }
    return maxZone;
  }

  /**
   * Calculate each trip fare based on peek-offpeek hour and weekday-weekend
   *
   * @param {Journey} singleJourney Journey data aggregated for a day
   * @returns number Fare value
   */
  _calculateSingleTripFare(singleJourney: Journey): number {
    return this._isPeekHour(singleJourney.dateTime)
      ? peekFares[singleJourney.from][singleJourney.to]
      : offPeekFares[singleJourney.from][singleJourney.to];
  }

  /**
   * Determines if time is peek hour for weekday and weekend
   * @param {Date | String} dateTime Date to get hours
   * @returns {boolean} Peek hour or not
   */
  _isPeekHour = (dateTime: Date): boolean => {
    const hours = this._getHours(dateTime);
    const dayOrEnd = this._isWeekend(dateTime) ? "weekend" : "weekday";
    return (
      (this._getHours(peekHours[dayOrEnd].mStart) <= hours &&
        this._getHours(peekHours[dayOrEnd].mEnd) >= hours) ||
      (this._getHours(peekHours[dayOrEnd].eStart) <= hours &&
        this._getHours(peekHours[dayOrEnd].eEnd) >= hours)
    );
  };

  /**
   * Calculates the hours for the time
   * @param {Date | String} peekTime Date to get hours
   * @returns {number} Calculated hours
   */
  _getHours = (peekTime: Date | string): number => {
    if (peekTime instanceof Date) {
      var [hours, minutes, seconds] = [
        peekTime.getHours(),
        peekTime.getMinutes(),
        peekTime.getSeconds(),
      ];
    } else {
      [hours, minutes, seconds] = peekTime.split(":").map((e) => Number(e));
    }
    return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000;
  };

  /**
   * Determines if the date is weekend or weekday
   *
   * @param {Date} dateTime Date to find
   * @returns {boolean} True if weekend
   */
  _isWeekend = (dateTime: Date): boolean => {
    return dateTime.getDay() == 0 || dateTime.getDay() == 6;
  };

  /**
   * Determines if the date is a valid date or not
   *
   * @param {Date} date Date to find
   * @returns {boolean} True if valid
   */
  _isValidDate = (date: Date): boolean => {
    return date instanceof Date && !isNaN(date.getHours());
  };
}

export default FareCalculation;
