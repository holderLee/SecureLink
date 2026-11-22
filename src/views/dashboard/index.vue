<script setup lang="ts">
defineOptions({
  name: "Dashboard",
  inheritAttrs: false,
});
import { ref, computed } from "vue";
import { useUserStore } from "@/store/modules/user";
import { useTransition, TransitionPresets } from "@vueuse/core";
import SvgIcon from "@/components/SvgIcon/index.vue";
import RadarChart from "./components/RadarChart.vue";
import PieChart from "./components/PieChart.vue";
import BarChart from "./components/BarChart.vue";

const date: Date = new Date();

const duration = 5000;

// 销售额
const amount = ref(0);
const amountOutput = useTransition(amount, {
  duration: duration,
  transition: TransitionPresets.easeOutExpo,
});
amount.value = 2000;

// 访客数
const visitCount = ref(0);
const visitCountOutput = useTransition(visitCount, {
  duration: duration,
  transition: TransitionPresets.easeOutExpo,
});
visitCount.value = 2000;

// IP数
const dauCount = ref(0);
const dauCountOutput = useTransition(dauCount, {
  duration: duration,
  transition: TransitionPresets.easeOutExpo,
});
dauCount.value = 2000;

// 订单量
const orderCount = ref(0);
const orderCountOutput = useTransition(orderCount, {
  duration: duration,
  transition: TransitionPresets.easeOutExpo,
});
orderCount.value = 2000;
</script>

<template>
  <div class="dashboard-container">
    <!-- 数据卡片 -->
    <el-row :gutter="10">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-[var(--el-text-color-secondary)]">访客数</span>
              <el-tag type="success">日</el-tag>
            </div>
          </template>

          <div class="flex items-center justify-between mt-5">
            <div class="text-lg text-right">
              {{ Math.round(visitCountOutput) }}
            </div>
            <SvgIcon icon-class="visit" size="2em" />
          </div>

          <div
            class="flex items-center justify-between mt-5 text-sm text-[var(--el-text-color-secondary)]"
          >
            <span> 总访客数 </span>
            <span> {{ Math.round(visitCountOutput * 15) }} </span>
          </div>
        </el-card>
      </el-col>

      <!--消息数-->
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-[var(--el-text-color-secondary)]">IP数</span>
              <el-tag type="success">日</el-tag>
            </div>
          </template>

          <div class="flex items-center justify-between mt-5">
            <div class="text-lg text-right">
              {{ Math.round(dauCountOutput) }}
            </div>
            <SvgIcon icon-class="ip" size="2em" />
          </div>

          <div
            class="flex items-center justify-between mt-5 text-sm text-[var(--el-text-color-secondary)]"
          >
            <span> 总IP数 </span>
            <span> {{ Math.round(dauCountOutput) }} </span>
          </div>
        </el-card>
      </el-col>

      <!--销售额-->
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-[var(--el-text-color-secondary)]">销售额</span>
              <el-tag>月</el-tag>
            </div>
          </template>

          <div class="flex items-center justify-between mt-5">
            <div class="text-lg text-right">
              {{ Math.round(amountOutput) }}
            </div>
            <SvgIcon icon-class="money" size="2em" />
          </div>

          <div
            class="flex items-center justify-between mt-5 text-sm text-[var(--el-text-color-secondary)]"
          >
            <span> 总销售额 </span>
            <span> {{ Math.round(amountOutput * 15) }} </span>
          </div>
        </el-card>
      </el-col>

      <!--订单量-->
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-[var(--el-text-color-secondary)]">订单量</span>
              <el-tag type="danger">季</el-tag>
            </div>
          </template>

          <div class="flex items-center justify-between mt-5">
            <div class="text-lg text-right">
              {{ Math.round(orderCountOutput) }}
            </div>
            <SvgIcon icon-class="order" size="2em" />
          </div>

          <div
            class="flex items-center justify-between mt-5 text-sm text-[var(--el-text-color-secondary)]"
          >
            <span> 总订单量 </span>
            <span> {{ Math.round(orderCountOutput * 15) }} </span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Echarts 图表 -->
    <el-row :gutter="10" class="mt-3">
      <el-col :sm="24" :lg="8" class="mb-2">
        <BarChart
          id="barChart"
          height="400px"
          width="100%"
          class="bg-[var(--el-bg-color-overlay)]"
        />
      </el-col>

      <el-col :xs="24" :sm="12" :lg="8" class="mb-2">
        <PieChart
          id="pieChart"
          height="400px"
          width="100%"
          class="bg-[var(--el-bg-color-overlay)]"
        />
      </el-col>

      <el-col :xs="24" :sm="12" :lg="8" class="mb-2">
        <RadarChart
          id="radarChart"
          height="400px"
          width="100%"
          class="bg-[var(--el-bg-color-overlay)]"
        />
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-container {
  position: relative;
  padding: 20px;

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  .data-box {
    display: flex;
    justify-content: space-between;
    padding: 20px;
    font-weight: bold;
    color: var(--el-text-color-regular);
    background: var(--el-bg-color-overlay);
    border-color: var(--el-border-color);
    box-shadow: var(--el-box-shadow-dark);
  }

  .svg-icon {
    fill: currentcolor !important;
  }
}
</style>
