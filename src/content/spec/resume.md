---
numbering: none
---

<span style="font-weight:bold; font-size:2em;">沈可瑞 / Craig Shen / Kerui Shen</span>

## About Me

I am a junior undergraduate student in **Computer Science and Technology** at **Xi'an Jiaotong University**. My interests lie in **AI Infrastructure**, **Computer Networks**, and **Large Language Models**. I am particularly interested in building reliable and high-performance systems for AI workloads and large-scale model deployment.

## Research & Projects

**Edge-Side Distributed Visual Perception & Heterogeneous Communication System** | *Project Lead, National Innovation Program*

> *Note: This project yielded two Chinese National Invention Patents (currently under substantive review).*

- **Distributed Heterogeneous Architecture Design:** Designed a "dual-brain" heterogeneous vehicle architecture to distribute workloads across edge nodes (Jetson). Integrated RabbitMQ to build an on-board communication bus, utilizing topic-based routing to asynchronously decouple motion control from YOLO/SAM visual inference nodes to reduce system latency.

- **Complex Environment Communication Links:** Deployed a "Mobile Data Gateway" utilizing complementary 4G and LoRa links. Achieved reliable, long-distance (1.3km) multimodal data transmission in frontline tunnel environments.

- **Low-Level Network Deployment & Troubleshooting:** Managed the on-site hardware deployment of edge devices. Diagnosed and resolved IP address space overlapping issues caused by NAT in multi-tier cascaded router scenarios, implementing static routing policies to ensure stable cross-subnet device access.

**High-Performance Data Center Network Architecture & User-Space Protocol Stack** | *Independent Developer*

- **Cluster Network Topology Simulation:** Constructed and validated a k = 4 Fat-Tree multi-tier data center network topology using the Mininet virtual environment to simulate high-throughput cluster communication.

- **Routing & High Availability Strategies:** Investigated and resolved BGP routing black holes caused by AS number reuse in the Fat-Tree architecture. Validated Layer 2 redundant links and loop prevention using the Spanning Tree Protocol (STP).

- **User-Space TCP Stack Implementation:** Developed a user-space TCP protocol stack using Raw Sockets in C. Implemented the TCP 3-way handshake, 4-way connection termination, and sliding window flow control mechanism.

**Computer Architecture & Low-Level System Components** | *Core Developer*

- **Multi-Level Cache Simulator:** Developed an L1/L2/L3 cache read/write simulator for a single-core CPU architecture using C. Designed an architecture separating instructions and data, and implemented cache block eviction and replacement mechanisms based on the LRU (Least Recently Used) policy.

- **Dynamic Memory Allocator:** Implemented a dynamic memory manager replicating `malloc` and `free` functionalities based on OS heap memory layout. Designed and coded algorithms for linked-list-based memory block allocation, pointer-addressing deallocation, and memory fragmentation coalescing.

## Publications & Patents

### Publications

- Zhizhou Huang, Youmu Zhang, Chuanhao Lin, Quan Zhao, **Kerui Shen**, Lei Lu. "Zero-Query Decision-Based Black-Box via Sliding Window Patch Fusion." *The 3rd International Symposium on IoT and Intelligent Robotics (IoTIR)*, 2026. **(Accepted, to be indexed by EI/Scopus)**
- JinShan Liu, Haoran Qin, Xiaobing Tu, Jiacheng Liu, Jiahui Hu, Zhengan Yan, Yukun Xie, **Kerui Shen**, et al. "LinCa: Accelerating Diffusion Models via Learnable Decomposed Feature Caching." *Submitted to European Conference on Computer Vision (ECCV)*, 2026. **(Under Review)**

### Patents

- Lei Lu, Yu Wang, Xinling Wang, **Kerui Shen**, et al. "A LoRa-based Long-distance Multimodal Data Wireless Transmission Method." *Chinese National Invention Patent*, App No. 202511641960.0. **(Under Review)**
- Lei Lu, Zhenyuan Chen, Xinling Wang, Shenyi He, **Kerui Shen**, et al. "An Edge-side Data Perception and Full-process Automatic Acquisition Method for Tunnel Safety Monitoring." *Chinese National Invention Patent*, App No. 202511641969.1. **(Under Review)**

## Academic Experience

| Period            | Institution               | Major                                   |
| ----------------- | ------------------------- | --------------------------------------- |
| 2023.09 – Present | Xi'an Jiaotong University | B.S. in Computer Science and Technology |

### Ranking

- Freshmen Year: 30 of 193 total
- Sophomore Year: 27 of 187 total

### Core Courses

| Category                 | Course Title                     |   Score    | Credits | Terms                   |
| :----------------------- | :------------------------------- | :--------: | :-----: | :---------------------- |
| Mathematical Foundations | Linear Algebra                   |     95     |   4.0   | Fall 2023               |
|                          | Advanced Mathematics             | 91.5 (Avg) |  13.0   | Fall 2023 - Spring 2024 |
|                          | Discrete Mathematics             |     91     |   4.0   | Spring 2024             |
| Computer Systems         | Introduction to Computer Systems |     94     |   4.0   | Fall 2024               |
|                          | Operating Systems                |     91     |   3.0   | Spring 2025             |
|                          | Computer Networks                |     90     |   3.0   | Fall 2025               |
| Programming & Algorithms | Fundamentals of Programming      |     97     |   3.0   | Fall 2023               |
|                          | Object-Oriented Programming      |     93     |   2.5   | Spring 2024             |
|                          | Data Structures and Algorithms   |     91     |   3.5   | Fall 2024               |
| Artificial Intelligence  | Artificial Intelligence          |     94     |   2.5   | Spring 2026             |

### Honors & Awards

- **2nd-Class University Scholarship 2024-2025** - Xi'an Jiaotong University
- **3rd-Class University Scholarship 2023-2024** - Xi'an Jiaotong University
- **1st Prize in MCM/ICM Intramural Selection 2025** - Xi'an Jiaotong University

## Skills

- **Programming Languages:** C/C++, Python, Assembly (Basic)
- **Systems & Architecture:** Linux Administration (Arch Linux), Memory Management, Multi-Level Cache Design
- **Networking & Infrastructure:** TCP/IP Protocol Stack, Raw Sockets, Docker, RabbitMQ
- **Edge Computing & Hardware:** NVIDIA Jetson, Raspberry Pi, LoRa Communication
- **Tools:** Git, LaTeX, Markdown

## Contact

Email: <2943812220@qq.com> (recommended) / <shen_kerui@163.com> / <shen_kerui@stu.xjtu.edu.cn>

For the Chinese version of my resume, click <a href="/downloads/resume/resume-chinese-version.pdf" download>HERE</a>.
