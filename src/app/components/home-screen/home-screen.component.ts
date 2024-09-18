import { Component, OnInit } from '@angular/core';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
@Component({
  selector: 'app-home-screen',
  templateUrl: './home-screen.component.html',
  styleUrls: ['./home-screen.component.scss']
})
export class HomeScreenComponent implements OnInit {

  constructor() { }
  templateFileName: string = "";
  resultList: ResultModel[] = [];
  wrongEntriesList: string[] = [];
  loading: boolean = false;
  ngOnInit(): void {
    this.resultList = [];
  }

  fileBrowseHandler($event: any) {
    if ($event.target.files?.length > 0) {
      this.templateFileName = $event.target.files[0]?.name;
      const file = $event.target.files[0];
      this.uploadData($event.target.id, file);
    } else {
      (<HTMLInputElement>document.getElementById($event.target.id)).value = '';
    }
  }

  uploadData(id: string, file: any) {
    this.loading = true;
    this.resultList = [];
    this.wrongEntriesList = [];
    try {
      let fileReader = new FileReader();
      fileReader.readAsArrayBuffer(file);
      fileReader.onload = (e) => {
        const arrayBufferResult = fileReader.result as ArrayBuffer;
        const uint8ArrayData = new Uint8Array(arrayBufferResult);
        const arrayData = new Array();
        for (let i = 0; i != uint8ArrayData.length; ++i)
          arrayData[i] = String.fromCharCode(uint8ArrayData[i]);
        const workbook = XLSX.read(arrayData.join(''), { type: 'binary' });
        this.getExcelData(workbook);

      };
    } catch (e) {
      console.log('Error', e);
      (<HTMLInputElement>document.getElementById(id)).value = '';
    }
  }

  groupByKey(array: any[], key: string | number) {
    return array
      .reduce((hash, obj) => {
        if (obj[key] === undefined) return hash;
        return Object.assign(hash, { [obj[key]]: (hash[obj[key]] || []).concat(obj) })
      }, {})
  }
  private getExcelData(workbook: any) {
    const worksheet = workbook.Sheets["MTS"];
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, }) as any[];
    const dataList = data?.filter((x) => x.hasOwnProperty('Well'));
    const uniqueWellNames = [...new Set(dataList.map(item => item.Well))];
    const groupedList = this.groupByKey(dataList, 'Well');
    uniqueWellNames.forEach(element => {
      let items = groupedList[element];//update the well number ""RA-0201"" instead of element here to check specific well.
      this.getSummaryForWell(items);
    });
    this.resultList = [...new Map(this.resultList.map(item => [item["well"], item])).values()];

    this.resultList.forEach(final => {
      //final.tripList = [...new Map(final.tripList.map(item => [item["date"], item])).values()];
      let sum: number = final?.tripList.map(item => item.time).reduce((prev, next) => this.isValidNumber(prev) + this.isValidNumber(next));
      if (final?.tripList?.length < 31) {
        let tripLlen = 31 - final?.tripList?.length;
        for (let i = 0; i < tripLlen; i++) {
          final?.tripList.push(0);
        }
        final?.tripList.push({ time: sum });
      }
      if (final?.runTimeList?.length < 31) {
        // final.runTimeList = [...new Map(final.runTimeList.map(item => [item["date"], item])).values()];
        let sum: number = final?.runTimeList.map(item => item.time).reduce((prev, next) => this.isValidNumber(prev) + this.isValidNumber(next));
        let runLlen = 31 - final?.runTimeList?.length;
        for (let i = 0; i < runLlen; i++) {
          final?.runTimeList.push(0);
        }
        final?.runTimeList.push({ time: sum });
      }
      if (final?.costDeductionList?.length < 31) {
        // final.costDeductionList = [...new Map(final.costDeductionList.map(item => [item["date"], item])).values()];
        let sum: number = final?.costDeductionList.map(item => item.time).reduce((prev, next) => this.isValidNumber(prev) + this.isValidNumber(next));
        let costLlen = 31 - final?.costDeductionList?.length;
        for (let i = 0; i < costLlen; i++) {
          final?.costDeductionList.push(0);
        }
        final?.costDeductionList.push({ time: sum });
      }
    });
    this.wrongEntriesList = this.wrongEntriesList.filter((n, i) => this.wrongEntriesList.indexOf(n) === i);
    if(this.wrongEntriesList.length>0){
      Swal.fire('Wrong Entries in found in these Wells!', this.wrongEntriesList.toString(), 'warning');
    }
    this.loading = false;
  }

  public isValidNumber(value: any): number {
    return !value || Number.isNaN(value) || !Number.isFinite(Number(value)) || value < 0 ? 0 : Number(value);
  }
  getSummaryForWell(wellInfo: any) {
    let tripList: any[32] = [];
    let runTimeList: any[32] = [];
    let costDeductionList: any[32] = [];
    wellInfo?.forEach((ele: any) => {
      let isExist = this.resultList?.find((x: { date: any; well: any; }) => x.date === ele?.Date && x.well === ele?.Well);
      if (isExist) {
        return;
      }
      const tripTime = (ele['Trip Time'] || '').toString().trim();
      const restartTime = (ele['Restart Time'] || '').toString().trim();
      const well = (ele['Well'] || '').toString().trim();
      if ((tripTime != "" && restartTime != "") && (new Date(tripTime)?.getDate() != new Date(restartTime)?.getDate())) {
        this.wrongEntriesList.push(well);
      }

      let obj: any;
      if (tripTime == "" && restartTime == "") {//non stopped
        obj = this.setResultObject(ele, WorkingType.NonStopped, wellInfo);
      } else if (tripTime != "" && restartTime != "") {
        obj = this.setResultObject(ele, WorkingType.Restarted, wellInfo);
      } else if (tripTime != "" && restartTime == "") {
        obj = this.setResultObject(ele, WorkingType.StartNotStopped);
      } else if (tripTime == "" && restartTime != "") {
        obj = this.setResultObject(ele, WorkingType.OnlyRestart);
      }
      tripList.push({ date: obj.date, time: obj?.dailyTripTime });
      runTimeList.push({ date: obj.date, time: obj?.runTime });
      costDeductionList.push({ date: obj.date, time: obj?.costDeduction });
      obj.tripList = tripList;
      obj.runTimeList = runTimeList;
      obj.costDeductionList = costDeductionList;
      this.resultList.push(obj);
    });
  }

  setResultObject(item: any, workingType: number, wellInfo: any = null) {
    let obj: ResultModel = new ResultModel();
    let dailyTripTime = 0;
    let runTime = 0;
    if (workingType === WorkingType.NonStopped) {
      runTime = 24 * 60;
      dailyTripTime = 0;
      const previousEntry: any[] = wellInfo.filter((x: any) => new Date(x.Date) < new Date(item.Date) && x["Trip Time"] != null);
      const nexEntry: any[] = wellInfo.filter((x: any) => new Date(x.Date) < new Date(item.Date) && x["Restart Time"] != null);
      previousEntry.forEach(prev => {
        if (new Date(item.Date) > new Date(prev["Date"])) {
          dailyTripTime = 1440;
          runTime = 0;
          return;
        }
      });
      nexEntry.forEach(prev => {
        if (new Date(item.Date) > new Date(prev["Date"])) {
          runTime = 24 * 60;
          dailyTripTime = 0;
          return;
        }
      });
      
    } else if (workingType === WorkingType.Restarted) {
      const idCountMap = wellInfo.reduce((acc: any, dup: any) => {
        acc[dup.Date] = (acc[dup.Date] || 0) + 1;
        return acc;
      }, {} as Record<any, any>);

      const duplicates: any[] = wellInfo.filter((dup: { Date: string | number; }) => idCountMap[dup.Date] > 1);
      const matchingData = duplicates?.filter(x => x.Date === item.Date);
      if (duplicates?.length > 0 && matchingData?.length > 0) {
        let totalTrip = 0;
        matchingData.forEach(function (trip: any, index) {
          let newDate = new Date(trip['Date'] + " 00:00");
          newDate.setDate(newDate.getDate() + 1)?.toString();
          let restartTime = trip['Restart Time'] === undefined ? newDate : new Date(trip['Restart Time']);
          let tripTime = trip['Trip Time'] === undefined ? new Date(trip['Date'] + " 00:00") : new Date(trip['Trip Time']);
          let milliDiff = restartTime?.getTime() - tripTime?.getTime();
          const totalMinutes = Math.floor(milliDiff / 1000);
          if (index < matchingData?.length) {
            totalTrip += Math.floor(totalMinutes / 60);
            dailyTripTime = totalTrip;
            runTime = 1440 - dailyTripTime;
            return;
          }
        });
      }
      else {
        let milliDiff = new Date(item['Restart Time'])?.getTime() - new Date(item['Trip Time'])?.getTime();
        const totalMinutes = Math.floor(milliDiff / 1000);
        dailyTripTime = Math.floor(totalMinutes / 60);
        runTime = 1440 - dailyTripTime;
      }

    } else if (workingType === WorkingType.StartNotStopped) {
      var tripDate = new Date(item['Trip Time']);
      var currentDate = new Date(item['Date']);
      if(tripDate.getDate()===currentDate.getDate()){
        runTime = this.convertToMinutes(tripDate?.getHours(), tripDate.getMinutes(), tripDate?.getSeconds());
      dailyTripTime = 1440 - runTime;
      }
      else if (item['Status']==="OFF"){
        runTime=0;
        dailyTripTime=1440;

      }
    } else if (workingType === WorkingType.Stopped) {
      var restartDate = new Date(item['Restart Time']);
      runTime = this.convertToMinutes(restartDate?.getHours(), restartDate.getMinutes(), restartDate?.getSeconds());
      dailyTripTime = 1440 - runTime;
    } else if (workingType === WorkingType.OnlyRestart) {
      var restartDate = new Date(item['Restart Time']);
      dailyTripTime = this.convertToMinutes(restartDate?.getHours(), restartDate.getMinutes(), restartDate?.getSeconds());
      runTime = 1440 - dailyTripTime;
    }

    obj.date = item['Date'];
    obj.well = item['Well'];
    obj.index = Number(item['Index']);
    obj.status = item['Status'];
    obj.reason = item['Stop Reason'];
    obj.tripCategory = item['Trip Category'];
    obj.rootCause = item['Root Cause'];
    obj.tripTime = item['Trip Time'];
    obj.restartTime = item['Restart Time'];
    obj.dailyTripTime = dailyTripTime;
    obj.runTime = runTime;
    if (dailyTripTime > 720) {
      if ((obj.rootCause)?.toLowerCase()?.match(/gener.*/) || (obj.rootCause)?.toLowerCase()?.match(/vsd.*/)) {
        obj.costDeduction = dailyTripTime - 720;
        obj.dailyTripTime = 720;
      } else obj.costDeduction = 0;
    } else { obj.costDeduction = 0 }

    if (obj.status === "WO") {
      obj.dailyTripTime = 0;
      obj.runTime = 0;
      obj.costDeduction = 0;
    }
    return obj;
  }

  convertToMinutes(hours: number, minutes: number, seconds: number): number {
    const totalMinutes = (hours * 60) + minutes + (seconds / 60);
    return totalMinutes;
  }

  exportToExcel() {
    const table = document.getElementById('myTable');
    const workbook = XLSX.utils.table_to_book(table, { raw: true, cellStyles: true, cellDates: true });
    // let worksheet = workbook.Sheets["Sheet1"];
    // worksheet["A1"].s = {
    //   font: {
    //     alignment: "center",
    //     fill: { bgColor: "#e8ffdb" }
    //   },
    // };
    XLSX.writeFile(workbook, this.templateFileName);
  }
}


export class ResultModel {
  date: string = "";
  well: string = "";
  index: number = 0;
  status: string = "";
  reason: string = "";
  tripCategory: string = "";
  rootCause: string = "";
  tripTime: string = "";
  restartTime: string = "";
  dailyTripTime: number = 0;
  runTime: number = 0;
  costDeduction: number = 0;

  tripList: any[] = [];
  runTimeList: any[] = [];
  costDeductionList: any[] = [];
}



export enum WorkingType {
  NonStopped = 1,
  Restarted = 2,
  StartNotStopped = 3,
  Stopped = 4,
  OnlyRestart = 5
}


